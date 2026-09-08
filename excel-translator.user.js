// ==UserScript==
// @name         Excel 번역 적용기 TEST
// @namespace    yangoon.excel.translation
// @version      0.1.0
// @description  기준 Excel의 한국어 이름을 기준으로 허용된 번역/설명 값만 적용
// @match        http://*/*
// @match        https://*/*
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const KEY_HEADER = '한국어 이름';

    const ALLOWED_HEADERS = [
        '영어 이름',
        '중국어 이름',
        '일본어 이름',
        '한국어 설명',
        '영어 설명',
        '중국어 설명',
        '일본어 설명',
    ];

    const MAX_HEADER_SCAN_ROWS = 30;

    let panel = null;

    // Ctrl + Shift + E
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
            e.preventDefault();
            togglePanel();
        }
    });

    function togglePanel() {

        if (panel) {
            panel.remove();
            panel = null;
            return;
        }

        panel = document.createElement('div');

        panel.innerHTML = `
        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:10px;
            background:#eee;
            border-bottom:1px solid #ccc;
        ">
            <b>Excel 번역 적용기 TEST</b>
            <button id="yg-close"
                style="border:0;background:none;font-size:22px;cursor:pointer">
                ×
            </button>
        </div>

        <div style="padding:12px">

            <div style="
                background:#f5f5f5;
                border:1px solid #ddd;
                padding:8px;
                margin-bottom:12px;
                line-height:1.6;
            ">
                기준 : <b>한국어 이름</b><br>
                변경 : 영어/중국어/일본어 이름<br>
                변경 : 한국어/영어/중국어/일본어 설명<br>
                <b>그 외 항목은 수정하지 않음</b>
            </div>

            <b>1. 기준 파일</b><br>
            <input id="yg-base"
                type="file"
                accept=".xlsx,.xlsm"
                style="width:100%;margin:6px 0 12px">

            <b>2. 수정 파일</b><br>
            <input id="yg-mod"
                type="file"
                accept=".xlsx,.xlsm"
                style="width:100%;margin:6px 0 12px">

            <button id="yg-run"
                style="
                    width:100%;
                    padding:10px;
                    font-weight:bold;
                    cursor:pointer;
                ">
                변환하기
            </button>

            <pre id="yg-log"
                style="
                    background:#111;
                    color:#eee;
                    padding:10px;
                    margin-top:12px;
                    min-height:120px;
                    max-height:260px;
                    overflow:auto;
                    white-space:pre-wrap;
                ">파일 2개를 선택하세요.</pre>

        </div>
        `;

        Object.assign(panel.style, {
            position: 'fixed',
            zIndex: '2147483647',
            top: '20px',
            right: '20px',
            width: '430px',
            maxHeight: '85vh',
            overflow: 'auto',
            background: '#fff',
            color: '#111',
            border: '1px solid #777',
            borderRadius: '10px',
            boxShadow: '0 8px 28px rgba(0,0,0,.28)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px'
        });

        document.body.appendChild(panel);

        panel.querySelector('#yg-close')
            .addEventListener('click', togglePanel);

        panel.querySelector('#yg-run')
            .addEventListener('click', runConversion);
    }


    async function runConversion() {

        const logEl = panel.querySelector('#yg-log');
        const button = panel.querySelector('#yg-run');

        const baseFile =
            panel.querySelector('#yg-base').files[0];

        const modFile =
            panel.querySelector('#yg-mod').files[0];

        if (!baseFile || !modFile) {
            logEl.textContent =
                '기준 파일과 수정 파일을 둘 다 선택하세요.';
            return;
        }

        if (typeof JSZip === 'undefined') {
            logEl.textContent =
                'JSZip 라이브러리를 불러오지 못했습니다.\n' +
                '회사망에서 외부 CDN이 차단되었을 가능성이 있습니다.';
            return;
        }

        button.disabled = true;

        logEl.textContent = '파일을 읽는 중...';

        try {

            const [baseBuffer, modBuffer] =
                await Promise.all([
                    baseFile.arrayBuffer(),
                    modFile.arrayBuffer()
                ]);

            const baseXlsx =
                await loadXlsx(baseBuffer);

            const modXlsx =
                await loadXlsx(modBuffer);


            let processedSheets = 0;

            let totalBaseRows = 0;
            let totalMatched = 0;
            let totalExtraIgnored = 0;
            let totalWritten = 0;
            let totalBlank = 0;

            const logs = [];


            for (const [sheetName, basePath]
                 of baseXlsx.sheetMap.entries()) {

                const baseXmlFile =
                    baseXlsx.zip.file(basePath);

                if (!baseXmlFile)
                    continue;

                const baseXml =
                    await baseXmlFile.async('string');

                const baseDoc =
                    parseXml(baseXml);

                const baseInfo =
                    analyzeSheet(
                        baseDoc,
                        baseXlsx.sharedStrings
                    );

                // 한국어 이름이 없는 탭 무시
                if (!baseInfo)
                    continue;

                if (!baseInfo.headers.has(KEY_HEADER))
                    continue;


                const allowed =
                    ALLOWED_HEADERS.filter(
                        h => baseInfo.headers.has(h)
                    );

                // 변경할 열이 없으면 무시
                if (allowed.length === 0)
                    continue;


                const modPath =
                    modXlsx.sheetMap.get(sheetName);

                if (!modPath) {
                    throw new Error(
                        `수정 파일에 '${sheetName}' 탭이 없습니다.`
                    );
                }


                const modXml =
                    await modXlsx.zip
                        .file(modPath)
                        .async('string');

                const modDoc =
                    parseXml(modXml);

                const modInfo =
                    analyzeSheet(
                        modDoc,
                        modXlsx.sharedStrings
                    );


                if (!modInfo ||
                    !modInfo.headers.has(KEY_HEADER)) {

                    throw new Error(
                        `'${sheetName}' 탭에서 ` +
                        `'${KEY_HEADER}' 열을 찾지 못했습니다.`
                    );
                }


                const missingColumns =
                    allowed.filter(
                        h => !modInfo.headers.has(h)
                    );

                if (missingColumns.length) {

                    throw new Error(
                        `'${sheetName}' 탭의 수정 파일에 ` +
                        `필요한 열이 없습니다.\n` +
                        missingColumns.join(', ')
                    );
                }


                const modMap =
                    buildModifiedMap(
                        modInfo,
                        modXlsx.sharedStrings,
                        allowed,
                        sheetName
                    );


                const baseRows =
                    getDataRows(
                        baseInfo,
                        baseXlsx.sharedStrings
                    );


                const baseKeys =
                    new Set();

                let matched = 0;
                let written = 0;
                let blanks = 0;


                for (const row of baseRows) {

                    const key =
                        normalizeKey(
                            row.values.get(KEY_HEADER)
                        );

                    if (!key)
                        continue;


                    baseKeys.add(key);


                    const source =
                        modMap.get(key);


                    if (source)
                        matched++;


                    for (const header of allowed) {

                        /*
                         * 수정 파일에 메뉴가 없거나
                         * 해당 번역값이 비어 있으면
                         * 결과도 공란
                         */

                        const value =
                            source
                                ? (source.get(header) ?? '')
                                : '';


                        const column =
                            baseInfo.headers.get(header);


                        setCellValue(
                            baseDoc,
                            row.rowNumber,
                            column,
                            String(value ?? '')
                        );


                        written++;

                        if (String(value ?? '') === '')
                            blanks++;
                    }
                }


                /*
                 * 수정 파일에만 존재하는 메뉴 계산
                 * → 결과에는 넣지 않음
                 */

                let extraIgnored = 0;

                for (const key of modMap.keys()) {

                    if (!baseKeys.has(key))
                        extraIgnored++;
                }


                /*
                 * 수정된 기준 Sheet XML만
                 * 기준 파일에 다시 저장
                 */

                const newXml =
                    new XMLSerializer()
                        .serializeToString(baseDoc);

                baseXlsx.zip.file(
                    basePath,
                    newXml
                );


                processedSheets++;

                totalBaseRows += baseRows.length;
                totalMatched += matched;
                totalExtraIgnored += extraIgnored;
                totalWritten += written;
                totalBlank += blanks;


                logs.push(
                    `[${sheetName}]\n` +
                    `기준 : ${baseRows.length}\n` +
                    `매칭 : ${matched}\n` +
                    `추가 메뉴 무시 : ${extraIgnored}\n` +
                    `기록 셀 : ${written}\n` +
                    `공란 : ${blanks}`
                );
            }


            if (processedSheets === 0) {

                throw new Error(
                    `'한국어 이름'과 번역 열이 있는 ` +
                    `탭을 찾지 못했습니다.`
                );
            }


            /*
             * 결과 파일 생성
             */

            const blob =
                await baseXlsx.zip.generateAsync({
                    type: 'blob',
                    mimeType:
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    compression: 'DEFLATE'
                });


            const outputName =
                makeOutputName(baseFile.name);


            downloadBlob(
                blob,
                outputName
            );


            logEl.textContent =
                '변환 완료\n\n' +

                logs.join('\n\n') +

                '\n\n--------------------\n' +

                `처리 탭 : ${processedSheets}\n` +
                `기준 데이터 : ${totalBaseRows}\n` +
                `정상 매칭 : ${totalMatched}\n` +
                `추가 메뉴 무시 : ${totalExtraIgnored}\n` +
                `기록한 셀 : ${totalWritten}\n` +
                `공란 처리 : ${totalBlank}\n\n` +

                `저장 : ${outputName}\n\n` +

                '※ 한국어 이름은 수정하지 않습니다.\n' +
                '※ 허용된 번역/설명 열 외에는 값을 쓰지 않습니다.';


        } catch (error) {

            console.error(error);

            logEl.textContent =
                '변환 실패\n\n' +
                (error.message || error);
        }

        finally {
            button.disabled = false;
        }
    }



    /*
     * XLSX 읽기
     */

    async function loadXlsx(buffer) {

        const zip =
            await JSZip.loadAsync(buffer);


        const workbookXml =
            await zip
                .file('xl/workbook.xml')
                ?.async('string');


        const relsXml =
            await zip
                .file('xl/_rels/workbook.xml.rels')
                ?.async('string');


        if (!workbookXml || !relsXml) {
            throw new Error(
                '정상적인 XLSX/XLSM 파일이 아닙니다.'
            );
        }


        const workbookDoc =
            parseXml(workbookXml);

        const relsDoc =
            parseXml(relsXml);


        const relationMap =
            new Map();


        for (const relation
             of [...relsDoc
                 .getElementsByTagName('Relationship')]) {

            relationMap.set(
                relation.getAttribute('Id'),
                relation.getAttribute('Target')
            );
        }


        const sheetMap =
            new Map();


        for (const sheet
             of [...workbookDoc
                 .getElementsByTagName('sheet')]) {

            const name =
                sheet.getAttribute('name');

            const rid =
                sheet.getAttribute('r:id') ||
                sheet.getAttributeNS(
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                    'id'
                );


            const target =
                relationMap.get(rid);


            if (name && target) {
                sheetMap.set(
                    name,
                    resolveXlPath(target)
                );
            }
        }


        const sharedStrings =
            await readSharedStrings(zip);


        return {
            zip,
            sheetMap,
            sharedStrings
        };
    }



    /*
     * Shared Strings
     */

    async function readSharedStrings(zip) {

        const file =
            zip.file('xl/sharedStrings.xml');

        if (!file)
            return [];


        const xml =
            await file.async('string');


        const doc =
            parseXml(xml);


        const result = [];


        for (const si
             of [...doc
                 .getElementsByTagName('si')]) {

            const text =
                [...si
                    .getElementsByTagName('t')]
                    .map(t => t.textContent || '')
                    .join('');


            result.push(text);
        }


        return result;
    }



    /*
     * 헤더 찾기
     */

    function analyzeSheet(
        sheetDoc,
        sharedStrings
    ) {

        const rows =
            [...sheetDoc
                .getElementsByTagName('row')];


        for (const row
             of rows.slice(
                 0,
                 MAX_HEADER_SCAN_ROWS
             )) {

            const rowValues =
                getRowValues(
                    row,
                    sharedStrings
                );


            const headers =
                new Map();


            for (const [column, value]
                 of rowValues.entries()) {

                const text =
                    String(value ?? '').trim();

                if (text)
                    headers.set(
                        text,
                        column
                    );
            }


            if (!headers.has(KEY_HEADER))
                continue;


            if (!ALLOWED_HEADERS.some(
                h => headers.has(h)
            )) {
                continue;
            }


            return {

                sheetDoc,

                headerRowNumber:
                    Number(
                        row.getAttribute('r')
                    ) || 1,

                headers
            };
        }


        return null;
    }



    /*
     * 데이터 행 읽기
     */

    function getDataRows(
        info,
        sharedStrings
    ) {

        const rows =
            [...info.sheetDoc
                .getElementsByTagName('row')];


        const result = [];


        for (const row of rows) {

            const rowNumber =
                Number(
                    row.getAttribute('r')
                ) || 0;


            if (
                rowNumber <=
                info.headerRowNumber
            ) {
                continue;
            }


            const rowValues =
                getRowValues(
                    row,
                    sharedStrings
                );


            const values =
                new Map();


            for (const [header, column]
                 of info.headers.entries()) {

                values.set(
                    header,
                    rowValues.get(column) ?? ''
                );
            }


            if (
                normalizeKey(
                    values.get(KEY_HEADER)
                )
            ) {

                result.push({
                    rowNumber,
                    values
                });
            }
        }


        return result;
    }



    /*
     * 수정 파일
     * 한국어 이름 → 데이터 Map
     */

    function buildModifiedMap(
        info,
        sharedStrings,
        allowedHeaders,
        sheetName
    ) {

        const rows =
            getDataRows(
                info,
                sharedStrings
            );


        const map =
            new Map();


        for (const row of rows) {

            const key =
                normalizeKey(
                    row.values.get(KEY_HEADER)
                );


            if (!key)
                continue;


            /*
             * 동일 한국어 이름이 2개면
             * 어느 행인지 판단하지 않음
             */

            if (map.has(key)) {

                throw new Error(
                    `수정 파일 '${sheetName}' 탭에 ` +
                    `중복된 한국어 이름이 있습니다.\n\n` +
                    key
                );
            }


            const data =
                new Map();


            for (const header
                 of allowedHeaders) {

                data.set(
                    header,
                    row.values.get(header) ?? ''
                );
            }


            map.set(
                key,
                data
            );
        }


        return map;
    }



    /*
     * 행의 모든 셀 읽기
     */

    function getRowValues(
        row,
        sharedStrings
    ) {

        const map =
            new Map();


        const cells =
            [...row
                .getElementsByTagName('c')];


        for (const cell of cells) {

            const ref =
                cell.getAttribute('r') || '';


            const column =
                getColumnLetters(ref);


            if (!column)
                continue;


            map.set(
                column,
                getCellText(
                    cell,
                    sharedStrings
                )
            );
        }


        return map;
    }



    /*
     * 셀 문자열 읽기
     */

    function getCellText(
        cell,
        sharedStrings
    ) {

        const type =
            cell.getAttribute('t');


        if (type === 'inlineStr') {

            return [...cell
                .getElementsByTagName('t')]
                .map(t =>
                    t.textContent || ''
                )
                .join('');
        }


        const valueNode =
            cell
                .getElementsByTagName('v')[0];


        const raw =
            valueNode
                ? (valueNode.textContent || '')
                : '';


        if (type === 's') {

            const index =
                Number(raw);

            return Number.isFinite(index)
                ? (sharedStrings[index] ?? '')
                : '';
        }


        return raw;
    }



    /*
     * 허용된 셀에 실제 값 기록
     *
     * 수식 생성 X
     */

    function setCellValue(
        sheetDoc,
        rowNumber,
        column,
        value
    ) {

        const ns =
            sheetDoc.documentElement.namespaceURI ||
            'http://schemas.openxmlformats.org/spreadsheetml/2006/main';


        const rows =
            [...sheetDoc
                .getElementsByTagName('row')];


        let row =
            rows.find(
                r =>
                    Number(
                        r.getAttribute('r')
                    ) === rowNumber
            );


        if (!row) {

            row =
                sheetDoc.createElementNS(
                    ns,
                    'row'
                );


            row.setAttribute(
                'r',
                String(rowNumber)
            );


            sheetDoc
                .getElementsByTagName(
                    'sheetData'
                )[0]
                .appendChild(row);
        }


        const ref =
            `${column}${rowNumber}`;


        let cell =
            [...row
                .getElementsByTagName('c')]
                .find(
                    c =>
                        c.getAttribute('r') === ref
                );


        if (!cell) {

            cell =
                sheetDoc.createElementNS(
                    ns,
                    'c'
                );


            cell.setAttribute(
                'r',
                ref
            );


            insertCellInOrder(
                row,
                cell
            );
        }


        /*
         * 기존 수식/값 제거
         */

        for (const tag
             of ['f', 'v', 'is']) {

            for (const node
                 of [...cell
                     .getElementsByTagName(tag)]) {

                node.remove();
            }
        }


        /*
         * 공란
         */

        if (value === '') {

            cell.removeAttribute('t');

            return;
        }


        /*
         * 실제 문자열 값
         */

        cell.setAttribute(
            't',
            'inlineStr'
        );


        const is =
            sheetDoc.createElementNS(
                ns,
                'is'
            );


        const text =
            sheetDoc.createElementNS(
                ns,
                't'
            );


        if (/^\s|\s$/.test(value)) {

            text.setAttribute(
                'xml:space',
                'preserve'
            );
        }


        text.textContent =
            value;


        is.appendChild(text);

        cell.appendChild(is);
    }



    function insertCellInOrder(
        row,
        newCell
    ) {

        const newColumn =
            columnToNumber(
                getColumnLetters(
                    newCell.getAttribute('r')
                )
            );


        const cells =
            [...row
                .getElementsByTagName('c')];


        const before =
            cells.find(cell => {

                return columnToNumber(
                    getColumnLetters(
                        cell.getAttribute('r')
                    )
                ) > newColumn;
            });


        if (before) {
            row.insertBefore(
                newCell,
                before
            );
        }
        else {
            row.appendChild(
                newCell
            );
        }
    }



    function parseXml(text) {

        const doc =
            new DOMParser()
                .parseFromString(
                    text,
                    'application/xml'
                );


        if (
            doc.getElementsByTagName(
                'parsererror'
            )[0]
        ) {

            throw new Error(
                'Excel 내부 데이터를 읽는 중 오류가 발생했습니다.'
            );
        }


        return doc;
    }



    function resolveXlPath(target) {

        if (target.startsWith('/')) {

            return target.replace(
                /^\//,
                ''
            );
        }


        const parts =
            (`xl/${target}`)
                .split('/');


        const output = [];


        for (const part of parts) {

            if (
                !part ||
                part === '.'
            ) {
                continue;
            }


            if (part === '..') {
                output.pop();
            }
            else {
                output.push(part);
            }
        }


        return output.join('/');
    }



    function getColumnLetters(ref) {

        const match =
            String(ref)
                .match(
                    /^([A-Z]+)\d+$/i
                );


        return match
            ? match[1].toUpperCase()
            : '';
    }



    function columnToNumber(column) {

        let result = 0;


        for (const char of column) {

            result =
                result * 26 +
                (
                    char.charCodeAt(0) -
                    64
                );
        }


        return result;
    }



    /*
     * 앞뒤 공백은 무시
     */

    function normalizeKey(value) {

        return String(
            value ?? ''
        ).trim();
    }



    function makeOutputName(name) {

        const match =
            name.match(
                /^(.*?)(\.(xlsx|xlsm))$/i
            );


        if (!match)
            return `${name}_완성본.xlsx`;


        return (
            `${match[1]}_완성본${match[2]}`
        );
    }



    function downloadBlob(
        blob,
        filename
    ) {

        const url =
            URL.createObjectURL(blob);


        const a =
            document.createElement('a');


        a.href = url;
        a.download = filename;


        document.body.appendChild(a);

        a.click();

        a.remove();


        setTimeout(
            () =>
                URL.revokeObjectURL(url),
            3000
        );
    }

})();
