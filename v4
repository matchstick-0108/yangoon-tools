// ==UserScript==
// @name         Excel 번역 적용기 AUTO
// @namespace    yangoon.excel.translation
// @version      0.4.0
// @description  A/M 양식을 자동 판별하여 번역/설명 변경값만 적용
// @match        http://*/*
// @match        https://*/*
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SHEET_NAME = '메뉴';
    const HEADER_ROW = 1;
    const KEY_COLUMN = 'D';

    /*
     * ============================================================
     * A / M 양식
     * ============================================================
     */

    const VERSION_CONFIG = {

        M: {
            name: 'M 버전',

            headers: {
                D: '한국어 이름',
                E: '영어 이름',
                F: '중국어 이름',
                G: '일본어 이름',
                H: '한국어 설명',
                I: '영어 설명',
                J: '중국어 설명',
                K: '일본어 설명'
            },

            targetColumns: [
                'E', 'F', 'G',
                'H', 'I', 'J', 'K'
            ]
        },

        A: {
            name: 'A 버전',

            headers: {
                D: '한국어 이름',
                E: '영어 이름',
                F: '중국어 이름',
                G: '일본어 이름',
                H: '러시아어 이름',
                I: '한국어 설명',
                J: '영어 설명',
                K: '중국어 설명',
                L: '일본어 설명',
                M: '러시아어 설명'
            },

            targetColumns: [
                'E', 'F', 'G', 'H',
                'I', 'J', 'K', 'L', 'M'
            ]
        }
    };


    let panel = null;


    /*
     * ============================================================
     * 단축키
     * Ctrl + Shift + E
     * ============================================================
     */

    window.addEventListener('keydown', (e) => {

        if (
            e.ctrlKey &&
            e.shiftKey &&
            e.code === 'KeyE'
        ) {

            e.preventDefault();

            togglePanel();
        }
    });



    /*
     * ============================================================
     * UI
     * ============================================================
     */

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
            padding:12px;
            background:#eeeeee;
            border-bottom:1px solid #cccccc;
        ">

            <b style="font-size:16px;">
                Excel 번역 적용기 AUTO
            </b>

            <button
                id="yg-close"
                style="
                    border:0;
                    background:none;
                    font-size:22px;
                    cursor:pointer;
                "
            >
                ×
            </button>

        </div>


        <div style="padding:14px;">


            <div style="
                background:#f5f5f5;
                border:1px solid #dddddd;
                padding:10px;
                margin-bottom:15px;
                line-height:1.7;
            ">

                <b>A/M 버전 자동 판별</b>
                <br>

                기준 :
                <b>D열 한국어 이름</b>

                <br>

                기준파일과 수정파일을 비교하여
                <br>

                <b>
                    실제로 다른 번역/설명 값만 변경합니다.
                </b>

                <br>

                다른 항목은 수정하지 않습니다.

            </div>


            <b>1. 기준 파일</b>

            <input
                id="yg-base"
                type="file"
                accept=".xlsx,.xlsm"
                style="
                    width:100%;
                    margin:7px 0 15px;
                "
            >


            <b>2. 수정 파일</b>

            <input
                id="yg-mod"
                type="file"
                accept=".xlsx,.xlsm"
                style="
                    width:100%;
                    margin:7px 0 15px;
                "
            >


            <button
                id="yg-run"
                style="
                    width:100%;
                    padding:12px;
                    font-size:14px;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                자동 판별 후 변환
            </button>


            <pre
                id="yg-log"
                style="
                    background:#111111;
                    color:#eeeeee;
                    padding:12px;
                    margin-top:14px;
                    min-height:140px;
                    max-height:330px;
                    overflow:auto;
                    white-space:pre-wrap;
                    line-height:1.6;
                "
            >기준 파일과 수정 파일을 선택하세요.</pre>

        </div>
        `;


        Object.assign(
            panel.style,
            {
                position: 'fixed',
                zIndex: '2147483647',
                top: '20px',
                right: '20px',
                width: '470px',
                maxHeight: '88vh',
                overflow: 'auto',
                background: '#ffffff',
                color: '#111111',
                border: '1px solid #777777',
                borderRadius: '10px',
                boxShadow: '0 8px 28px rgba(0,0,0,.28)',
                fontFamily: 'Arial, sans-serif',
                fontSize: '13px'
            }
        );


        document.body.appendChild(panel);


        panel
            .querySelector('#yg-close')
            .addEventListener(
                'click',
                togglePanel
            );


        panel
            .querySelector('#yg-run')
            .addEventListener(
                'click',
                runConversion
            );
    }



    /*
     * ============================================================
     * 변환
     * ============================================================
     */

    async function runConversion() {

        const logEl =
            panel.querySelector('#yg-log');


        const button =
            panel.querySelector('#yg-run');


        const baseFile =
            panel
                .querySelector('#yg-base')
                .files[0];


        const modFile =
            panel
                .querySelector('#yg-mod')
                .files[0];


        if (!baseFile || !modFile) {

            logEl.textContent =
                '기준 파일과 수정 파일을 모두 선택하세요.';

            return;
        }


        if (typeof JSZip === 'undefined') {

            logEl.textContent =
                'Excel 처리 라이브러리를 불러오지 못했습니다.';

            return;
        }


        button.disabled = true;

        button.textContent =
            '확인 중...';


        logEl.textContent =
            '파일을 읽고 A/M 버전을 자동 판별하고 있습니다...';


        try {

            /*
             * 파일 읽기
             */

            const [
                baseBuffer,
                modBuffer
            ] = await Promise.all([

                baseFile.arrayBuffer(),
                modFile.arrayBuffer()
            ]);


            const baseXlsx =
                await loadXlsx(
                    baseBuffer
                );


            const modXlsx =
                await loadXlsx(
                    modBuffer
                );


            /*
             * 메뉴 Sheet
             */

            const basePath =
                baseXlsx
                    .sheetMap
                    .get(SHEET_NAME);


            const modPath =
                modXlsx
                    .sheetMap
                    .get(SHEET_NAME);


            if (!basePath) {

                throw new Error(
                    `기준 파일에 '${SHEET_NAME}' 탭이 없습니다.`
                );
            }


            if (!modPath) {

                throw new Error(
                    `수정 파일에 '${SHEET_NAME}' 탭이 없습니다.`
                );
            }


            const baseXmlFile =
                baseXlsx.zip.file(
                    basePath
                );


            const modXmlFile =
                modXlsx.zip.file(
                    modPath
                );


            if (!baseXmlFile || !modXmlFile) {

                throw new Error(
                    '메뉴 Sheet 데이터를 읽을 수 없습니다.'
                );
            }


            const baseDoc =
                parseXml(
                    await baseXmlFile.async(
                        'string'
                    )
                );


            const modDoc =
                parseXml(
                    await modXmlFile.async(
                        'string'
                    )
                );


            /*
             * ====================================================
             * A / M 자동 판별
             * ====================================================
             */

            const baseVersion =
                detectVersion(
                    baseDoc,
                    baseXlsx.sharedStrings
                );


            const modVersion =
                detectVersion(
                    modDoc,
                    modXlsx.sharedStrings
                );


            if (!baseVersion) {

                throw new Error(
                    '기준 파일의 A/M 버전을 판별할 수 없습니다.'
                );
            }


            if (!modVersion) {

                throw new Error(
                    '수정 파일의 A/M 버전을 판별할 수 없습니다.'
                );
            }


            /*
             * 버전이 다르면 중단
             */

            if (baseVersion !== modVersion) {

                throw new Error(

                    '기준 파일과 수정 파일의 버전이 다릅니다.\n\n' +

                    `기준 파일 : ${VERSION_CONFIG[baseVersion].name}\n` +

                    `수정 파일 : ${VERSION_CONFIG[modVersion].name}\n\n` +

                    '같은 버전의 파일끼리 선택하세요.'
                );
            }


            const config =
                VERSION_CONFIG[
                    baseVersion
                ];


            /*
             * 전체 양식 검증
             */

            validateFormat(
                baseDoc,
                baseXlsx.sharedStrings,
                config,
                '기준 파일'
            );


            validateFormat(
                modDoc,
                modXlsx.sharedStrings,
                config,
                '수정 파일'
            );


            /*
             * 수정파일 Map
             */

            const modResult =
                buildModifiedMap(
                    modDoc,
                    modXlsx.sharedStrings,
                    config
                );


            const modMap =
                modResult.map;


            /*
             * 기준 데이터
             */

            const baseRows =
                getRows(
                    baseDoc
                );


            const baseKeys =
                new Set();


            let baseCount = 0;

            let matched = 0;

            let missing = 0;

            let extraIgnored = 0;

            let comparedCells = 0;

            let changedCells = 0;

            let unchangedCells = 0;

            let blankChanges = 0;

            let formulaConverted = 0;


            /*
             * 열별 변경 횟수
             */

            const changedByColumn =
                new Map();


            for (
                const column
                of config.targetColumns
            ) {

                changedByColumn.set(
                    column,
                    0
                );
            }



            /*
             * ====================================================
             * 기준파일만 순회
             *
             * 수정파일의 행 개수는 결과 개수에 영향 없음
             * ====================================================
             */

            for (
                const row
                of baseRows
            ) {

                const rowNumber =
                    Number(
                        row.getAttribute(
                            'r'
                        )
                    ) || 0;


                if (
                    rowNumber <=
                    HEADER_ROW
                ) {

                    continue;
                }


                const key =
                    normalizeKey(
                        readCellByColumn(
                            row,
                            KEY_COLUMN,
                            baseXlsx.sharedStrings
                        )
                    );


                /*
                 * D열 한국어 이름 없는 행은 무시
                 */

                if (!key) {

                    continue;
                }


                baseCount++;

                baseKeys.add(key);


                const source =
                    modMap.get(key);


                if (source) {

                    matched++;

                } else {

                    missing++;
                }



                /*
                 * 허용된 열만 비교
                 */

                for (
                    const column
                    of config.targetColumns
                ) {

                    comparedCells++;


                    const currentCell =
                        findCellByColumn(
                            row,
                            column
                        );


                    const oldValue =
                        currentCell
                            ? getCellText(
                                currentCell,
                                baseXlsx.sharedStrings
                            )
                            : '';


                    /*
                     * 수정파일에 해당 메뉴가 없으면
                     * 새 값은 공란
                     */

                    const newValue =
                        source
                            ? (
                                source.get(column)
                                ?? ''
                            )
                            : '';


                    const oldText =
                        String(
                            oldValue ?? ''
                        );


                    const newText =
                        String(
                            newValue ?? ''
                        );


                    /*
                     * 허용 대상 셀에 수식이 있는지
                     */

                    const hasFormula =
                        cellHasFormula(
                            currentCell
                        );


                    /*
                     * 값도 같고 수식도 없으면
                     * 아예 건드리지 않음
                     */

                    if (
                        oldText === newText &&
                        !hasFormula
                    ) {

                        unchangedCells++;

                        continue;
                    }


                    /*
                     * 값이 다르거나
                     * 수식이면 실제 값으로 기록
                     */

                    setCellValue(
                        baseDoc,
                        rowNumber,
                        column,
                        newText
                    );


                    changedCells++;


                    changedByColumn.set(
                        column,
                        (
                            changedByColumn.get(
                                column
                            ) || 0
                        ) + 1
                    );


                    if (
                        newText === ''
                    ) {

                        blankChanges++;
                    }


                    if (
                        hasFormula
                    ) {

                        formulaConverted++;
                    }
                }
            }



            /*
             * 수정파일에만 있는 메뉴 계산
             */

            for (
                const key
                of modMap.keys()
            ) {

                if (
                    !baseKeys.has(key)
                ) {

                    extraIgnored++;
                }
            }



            /*
             * 실제 변경이 있었다면
             * 메뉴 Sheet만 다시 저장
             */

            if (
                changedCells > 0
            ) {

                const newXml =
                    new XMLSerializer()
                        .serializeToString(
                            baseDoc
                        );


                baseXlsx.zip.file(
                    basePath,
                    newXml
                );
            }



            /*
             * 결과 파일 생성
             */

            const blob =
                await baseXlsx.zip
                    .generateAsync({

                        type: 'blob',

                        mimeType:
                            getMimeType(
                                baseFile.name
                            ),

                        compression:
                            'DEFLATE'
                    });


            const outputName =
                makeOutputName(
                    baseFile.name
                );


            downloadBlob(
                blob,
                outputName
            );



            /*
             * 변경 내역
             */

            const changeLines =
                [];


            for (
                const column
                of config.targetColumns
            ) {

                const header =
                    config.headers[
                        column
                    ];


                const count =
                    changedByColumn.get(
                        column
                    ) || 0;


                changeLines.push(
                    `${header} : ${count}`
                );
            }



            let duplicateText =
                '없음';


            if (
                modResult
                    .duplicateNames
                    .length > 0
            ) {

                duplicateText =
                    modResult
                        .duplicateNames
                        .join(', ');
            }



            /*
             * 완료 메시지
             */

            logEl.textContent =

                '변환 완료\n\n' +

                `자동 감지 : ${config.name}\n` +

                `기준 열 : D열 한국어 이름\n\n` +

                `기준 메뉴 : ${baseCount}\n` +

                `정상 매칭 : ${matched}\n` +

                `미매칭 : ${missing}\n` +

                `추가 메뉴 무시 : ${extraIgnored}\n` +

                `중복 행 무시 : ${modResult.duplicateCount}\n\n` +

                `비교한 셀 : ${comparedCells}\n` +

                `실제 변경 : ${changedCells}\n` +

                `동일하여 유지 : ${unchangedCells}\n` +

                `공란으로 변경 : ${blankChanges}\n` +

                `수식 → 값 변환 : ${formulaConverted}\n\n` +

                '항목별 실제 변경\n' +

                '--------------------\n' +

                changeLines.join('\n') +

                '\n\n' +

                `중복 한국어 이름 : ${duplicateText}\n\n` +

                `저장 파일\n${outputName}\n\n` +

                '✓ A/M 자동 판별\n' +

                '✓ D열 한국어 이름 유지\n' +

                '✓ 같은 값은 건드리지 않음\n' +

                '✓ 다른 값만 변경\n' +

                '✓ 허용된 이름/설명 열만 변경\n' +

                '✓ 추가 메뉴는 무시\n' +

                '✓ 다른 열은 수정하지 않음';


        } catch (error) {

            console.error(
                error
            );


            logEl.textContent =

                '변환 실패\n\n' +

                (
                    error.message ||
                    String(error)
                );

        } finally {

            button.disabled = false;

            button.textContent =
                '자동 판별 후 변환';
        }
    }



    /*
     * ============================================================
     * 버전 자동 감지
     * ============================================================
     */

    function detectVersion(
        sheetDoc,
        sharedStrings
    ) {

        const rows =
            getRows(
                sheetDoc
            );


        const headerRow =
            rows.find(
                row =>
                    Number(
                        row.getAttribute(
                            'r'
                        )
                    ) === HEADER_ROW
            );


        if (!headerRow) {

            return null;
        }


        const d =
            normalizeHeader(
                readCellByColumn(
                    headerRow,
                    'D',
                    sharedStrings
                )
            );


        const h =
            normalizeHeader(
                readCellByColumn(
                    headerRow,
                    'H',
                    sharedStrings
                )
            );


        /*
         * D열은 두 버전 모두 한국어 이름
         */

        if (
            d !==
            normalizeHeader(
                '한국어 이름'
            )
        ) {

            return null;
        }


        /*
         * A 버전
         */

        if (
            h ===
            normalizeHeader(
                '러시아어 이름'
            )
        ) {

            return 'A';
        }


        /*
         * M 버전
         */

        if (
            h ===
            normalizeHeader(
                '한국어 설명'
            )
        ) {

            return 'M';
        }


        return null;
    }



    /*
     * ============================================================
     * 전체 헤더 검증
     * ============================================================
     */

    function validateFormat(
        sheetDoc,
        sharedStrings,
        config,
        fileLabel
    ) {

        const rows =
            getRows(
                sheetDoc
            );


        const headerRow =
            rows.find(
                row =>
                    Number(
                        row.getAttribute(
                            'r'
                        )
                    ) === HEADER_ROW
            );


        if (!headerRow) {

            throw new Error(
                `${fileLabel}의 1행 헤더를 찾을 수 없습니다.`
            );
        }


        for (
            const [
                column,
                expected
            ]
            of Object.entries(
                config.headers
            )
        ) {

            const actual =
                normalizeHeader(
                    readCellByColumn(
                        headerRow,
                        column,
                        sharedStrings
                    )
                );


            const expectedNormalized =
                normalizeHeader(
                    expected
                );


            if (
                actual !==
                expectedNormalized
            ) {

                throw new Error(

                    `${fileLabel}의 양식이 예상과 다릅니다.\n\n` +

                    `자동 감지 : ${config.name}\n` +

                    `${column}열\n` +

                    `예상 : ${expected}\n` +

                    `실제 : ${
                        actual ||
                        '(공란)'
                    }`
                );
            }
        }
    }



    /*
     * ============================================================
     * 수정파일 Map 생성
     *
     * D열 한국어 이름 기준
     *
     * 중복 시 VLOOKUP처럼 첫 번째 사용
     * ============================================================
     */

    function buildModifiedMap(
        sheetDoc,
        sharedStrings,
        config
    ) {

        const rows =
            getRows(
                sheetDoc
            );


        const map =
            new Map();


        let duplicateCount =
            0;


        const duplicateNames =
            [];


        const duplicateSet =
            new Set();



        for (
            const row
            of rows
        ) {

            const rowNumber =
                Number(
                    row.getAttribute(
                        'r'
                    )
                ) || 0;


            if (
                rowNumber <=
                HEADER_ROW
            ) {

                continue;
            }


            const key =
                normalizeKey(
                    readCellByColumn(
                        row,
                        KEY_COLUMN,
                        sharedStrings
                    )
                );


            if (!key) {

                continue;
            }


            /*
             * 중복 한국어 이름
             *
             * 첫 번째 데이터 유지
             */

            if (
                map.has(key)
            ) {

                duplicateCount++;


                if (
                    !duplicateSet.has(
                        key
                    )
                ) {

                    duplicateSet.add(
                        key
                    );


                    duplicateNames.push(
                        key
                    );
                }


                continue;
            }


            const values =
                new Map();


            for (
                const column
                of config.targetColumns
            ) {

                values.set(

                    column,

                    readCellByColumn(
                        row,
                        column,
                        sharedStrings
                    ) ?? ''
                );
            }


            map.set(
                key,
                values
            );
        }


        return {
            map,
            duplicateCount,
            duplicateNames
        };
    }



    /*
     * ============================================================
     * Row
     * ============================================================
     */

    function getRows(
        sheetDoc
    ) {

        return [
            ...sheetDoc
                .getElementsByTagName(
                    'row'
                )
        ];
    }



    /*
     * ============================================================
     * 특정 열 Cell 찾기
     * ============================================================
     */

    function findCellByColumn(
        row,
        column
    ) {

        const cells =
            [
                ...row
                    .getElementsByTagName(
                        'c'
                    )
            ];


        return (
            cells.find(
                cell =>
                    getColumnLetters(
                        cell.getAttribute(
                            'r'
                        )
                    ) === column
            )
            || null
        );
    }



    /*
     * ============================================================
     * 특정 열 값 읽기
     * ============================================================
     */

    function readCellByColumn(
        row,
        column,
        sharedStrings
    ) {

        const cell =
            findCellByColumn(
                row,
                column
            );


        if (!cell) {

            return '';
        }


        return getCellText(
            cell,
            sharedStrings
        );
    }



    /*
     * ============================================================
     * Cell 값 읽기
     * ============================================================
     */

    function getCellText(
        cell,
        sharedStrings
    ) {

        if (!cell) {

            return '';
        }


        const type =
            cell.getAttribute(
                't'
            );


        /*
         * Inline String
         */

        if (
            type ===
            'inlineStr'
        ) {

            return [
                ...cell
                    .getElementsByTagName(
                        't'
                    )
            ]

            .map(
                node =>
                    node.textContent ||
                    ''
            )

            .join('');
        }


        const valueNode =
            cell
                .getElementsByTagName(
                    'v'
                )[0];


        const raw =
            valueNode
                ? (
                    valueNode
                        .textContent
                    ||
                    ''
                )
                : '';


        /*
         * Shared String
         */

        if (
            type === 's'
        ) {

            const index =
                Number(raw);


            return Number.isFinite(
                index
            )

                ? (
                    sharedStrings[
                        index
                    ]
                    ?? ''
                )

                : '';
        }


        return raw;
    }



    /*
     * ============================================================
     * 수식 여부
     * ============================================================
     */

    function cellHasFormula(
        cell
    ) {

        if (!cell) {

            return false;
        }


        return (
            cell
                .getElementsByTagName(
                    'f'
                )
                .length > 0
        );
    }



    /*
     * ============================================================
     * 실제 값 기록
     *
     * 허용된 셀에만 호출됨
     * ============================================================
     */

    function setCellValue(
        sheetDoc,
        rowNumber,
        column,
        value
    ) {

        const ns =
            sheetDoc
                .documentElement
                .namespaceURI
            ||
            'http://schemas.openxmlformats.org/spreadsheetml/2006/main';


        const rows =
            getRows(
                sheetDoc
            );


        const row =
            rows.find(
                current =>
                    Number(
                        current.getAttribute(
                            'r'
                        )
                    ) === rowNumber
            );


        if (!row) {

            throw new Error(
                `${rowNumber}행을 찾을 수 없습니다.`
            );
        }


        const ref =
            `${column}${rowNumber}`;


        let cell =
            findCellByColumn(
                row,
                column
            );


        /*
         * Cell이 없으면 생성
         */

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
         * 기존 수식 / 값 제거
         *
         * 스타일 속성 등은 유지
         */

        for (
            const tag
            of [
                'f',
                'v',
                'is'
            ]
        ) {

            const nodes =
                [
                    ...cell
                        .getElementsByTagName(
                            tag
                        )
                ];


            for (
                const node
                of nodes
            ) {

                node.remove();
            }
        }



        /*
         * 공란
         */

        if (
            value === ''
        ) {

            cell.removeAttribute(
                't'
            );


            return;
        }



        /*
         * 실제 문자열 값
         *
         * 수식 사용 안 함
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


        if (
            /^\s|\s$/.test(
                value
            )
        ) {

            text.setAttribute(
                'xml:space',
                'preserve'
            );
        }


        text.textContent =
            value;


        is.appendChild(
            text
        );


        cell.appendChild(
            is
        );
    }



    /*
     * ============================================================
     * Cell 열 순서 유지
     * ============================================================
     */

    function insertCellInOrder(
        row,
        newCell
    ) {

        const newColumn =
            columnToNumber(
                getColumnLetters(
                    newCell.getAttribute(
                        'r'
                    )
                )
            );


        const cells =
            [
                ...row
                    .getElementsByTagName(
                        'c'
                    )
            ];


        const before =
            cells.find(
                cell => {

                    const currentColumn =
                        columnToNumber(
                            getColumnLetters(
                                cell.getAttribute(
                                    'r'
                                )
                            )
                        );


                    return (
                        currentColumn >
                        newColumn
                    );
                }
            );


        if (before) {

            row.insertBefore(
                newCell,
                before
            );

        } else {

            row.appendChild(
                newCell
            );
        }
    }



    /*
     * ============================================================
     * XLSX 로드
     * ============================================================
     */

    async function loadXlsx(
        buffer
    ) {

        const zip =
            await JSZip.loadAsync(
                buffer
            );


        const workbookFile =
            zip.file(
                'xl/workbook.xml'
            );


        const relsFile =
            zip.file(
                'xl/_rels/workbook.xml.rels'
            );


        if (
            !workbookFile ||
            !relsFile
        ) {

            throw new Error(
                '정상적인 XLSX/XLSM 파일이 아닙니다.'
            );
        }


        const workbookDoc =
            parseXml(
                await workbookFile
                    .async(
                        'string'
                    )
            );


        const relsDoc =
            parseXml(
                await relsFile
                    .async(
                        'string'
                    )
            );


        const relationMap =
            new Map();


        for (
            const relation
            of [
                ...relsDoc
                    .getElementsByTagName(
                        'Relationship'
                    )
            ]
        ) {

            relationMap.set(

                relation.getAttribute(
                    'Id'
                ),

                relation.getAttribute(
                    'Target'
                )
            );
        }


        const sheetMap =
            new Map();


        for (
            const sheet
            of [
                ...workbookDoc
                    .getElementsByTagName(
                        'sheet'
                    )
            ]
        ) {

            const name =
                sheet.getAttribute(
                    'name'
                );


            const rid =
                sheet.getAttribute(
                    'r:id'
                )
                ||
                sheet.getAttributeNS(
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                    'id'
                );


            const target =
                relationMap.get(
                    rid
                );


            if (
                name &&
                target
            ) {

                sheetMap.set(
                    name,
                    resolveXlPath(
                        target
                    )
                );
            }
        }


        const sharedStrings =
            await readSharedStrings(
                zip
            );


        return {
            zip,
            sheetMap,
            sharedStrings
        };
    }



    /*
     * ============================================================
     * Shared Strings
     * ============================================================
     */

    async function readSharedStrings(
        zip
    ) {

        const file =
            zip.file(
                'xl/sharedStrings.xml'
            );


        if (!file) {

            return [];
        }


        const doc =
            parseXml(
                await file.async(
                    'string'
                )
            );


        const result =
            [];


        for (
            const si
            of [
                ...doc
                    .getElementsByTagName(
                        'si'
                    )
            ]
        ) {

            const text =
                [
                    ...si
                        .getElementsByTagName(
                            't'
                        )
                ]

                .map(
                    node =>
                        node.textContent
                        || ''
                )

                .join('');


            result.push(
                text
            );
        }


        return result;
    }



    /*
     * ============================================================
     * XML
     * ============================================================
     */

    function parseXml(
        text
    ) {

        const doc =
            new DOMParser()
                .parseFromString(
                    text,
                    'application/xml'
                );


        if (
            doc
                .getElementsByTagName(
                    'parsererror'
                )[0]
        ) {

            throw new Error(
                'Excel 내부 XML을 읽는 중 오류가 발생했습니다.'
            );
        }


        return doc;
    }



    /*
     * ============================================================
     * XLSX 내부 경로
     * ============================================================
     */

    function resolveXlPath(
        target
    ) {

        if (
            target.startsWith(
                '/'
            )
        ) {

            return target.replace(
                /^\//,
                ''
            );
        }


        const parts =
            (`xl/${target}`)
                .split('/');


        const output =
            [];


        for (
            const part
            of parts
        ) {

            if (
                !part ||
                part === '.'
            ) {

                continue;
            }


            if (
                part === '..'
            ) {

                output.pop();

            } else {

                output.push(
                    part
                );
            }
        }


        return output.join(
            '/'
        );
    }



    /*
     * ============================================================
     * 열
     * ============================================================
     */

    function getColumnLetters(
        ref
    ) {

        const match =
            String(
                ref || ''
            ).match(
                /^([A-Z]+)\d+$/i
            );


        return match

            ? match[1]
                .toUpperCase()

            : '';
    }



    function columnToNumber(
        column
    ) {

        let result = 0;


        for (
            const char
            of column
        ) {

            result =
                result * 26
                +
                (
                    char
                        .charCodeAt(0)
                    -
                    64
                );
        }


        return result;
    }



    /*
     * ============================================================
     * 비교용 정규화
     * ============================================================
     */

    function normalizeKey(
        value
    ) {

        return String(
            value ?? ''
        ).trim();
    }



    /*
     * 헤더의 줄바꿈/연속공백 차이는 무시
     */

    function normalizeHeader(
        value
    ) {

        return String(
            value ?? ''
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim();
    }



    /*
     * ============================================================
     * 결과 파일명
     *
     * 기준.xlsx
     * →
     * 기준_완성본.xlsx
     * ============================================================
     */

    function makeOutputName(
        name
    ) {

        const match =
            name.match(
                /^(.*?)(\.(xlsx|xlsm))$/i
            );


        if (!match) {

            return (
                `${name}_완성본.xlsx`
            );
        }


        return (
            `${match[1]}_완성본${match[2]}`
        );
    }



    /*
     * ============================================================
     * MIME
     * ============================================================
     */

    function getMimeType(
        name
    ) {

        if (
            /\.xlsm$/i.test(
                name
            )
        ) {

            return (
                'application/vnd.ms-excel.sheet.macroEnabled.12'
            );
        }


        return (
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
    }



    /*
     * ============================================================
     * 다운로드
     * ============================================================
     */

    function downloadBlob(
        blob,
        filename
    ) {

        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                'a'
            );


        link.href =
            url;


        link.download =
            filename;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            3000
        );
    }

})();
