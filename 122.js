// ==UserScript==
// @name         Excel 번역 적용기
// @namespace    yangoon.excel.translation
// @version      0.2.0
// @description  기준 Excel의 한국어 이름을 기준으로 번역/설명 값만 적용
// @match        http://*/*
// @match        https://*/*
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /*
     * ============================================================
     * 기본 규칙
     * ============================================================
     *
     * 매칭 기준:
     *   한국어 이름
     *
     * 변경 가능한 항목:
     *   영어 이름
     *   중국어 이름
     *   일본어 이름
     *   한국어 설명
     *   영어 설명
     *   중국어 설명
     *   일본어 설명
     *
     * 그 외 항목:
     *   절대 수정하지 않음
     *
     * 수정 파일에만 존재하는 메뉴:
     *   무시
     *
     * 수정 파일에 같은 한국어 이름이 여러 개:
     *   첫 번째 항목만 사용 (VLOOKUP 방식)
     *
     * 수정 파일에 메뉴가 없거나 값이 비어 있음:
     *   대상 번역/설명 셀은 공란 처리
     *
     * 수식:
     *   사용하지 않음
     *
     * 결과:
     *   기준 파일을 바탕으로 생성
     * ============================================================
     */

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
     * 화면
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
            <b style="font-size:15px;">
                Excel 번역 적용기
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
                margin-bottom:14px;
                line-height:1.7;
            ">

                기준 :
                <b>한국어 이름</b>
                <br>

                변경 :
                영어/중국어/일본어 이름
                <br>

                변경 :
                한국어/영어/중국어/일본어 설명
                <br>

                <b>
                    그 외 항목은 절대 수정하지 않음
                </b>

            </div>


            <div style="margin-bottom:14px;">

                <b>1. 기준 파일</b>
                <br>

                <input
                    id="yg-base"
                    type="file"
                    accept=".xlsx,.xlsm"
                    style="
                        width:100%;
                        margin-top:7px;
                    "
                >

            </div>


            <div style="margin-bottom:14px;">

                <b>2. 수정 파일</b>
                <br>

                <input
                    id="yg-mod"
                    type="file"
                    accept=".xlsx,.xlsm"
                    style="
                        width:100%;
                        margin-top:7px;
                    "
                >

            </div>


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
                변환하기
            </button>


            <pre
                id="yg-log"
                style="
                    background:#111111;
                    color:#eeeeee;
                    padding:12px;
                    margin-top:14px;
                    min-height:130px;
                    max-height:300px;
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
                width: '450px',
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
     * 변환 실행
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


        /*
         * 파일 선택 확인
         */

        if (!baseFile || !modFile) {

            logEl.textContent =
                '기준 파일과 수정 파일을 둘 다 선택하세요.';

            return;
        }


        /*
         * JSZip 확인
         */

        if (typeof JSZip === 'undefined') {

            logEl.textContent =
                'Excel 처리 라이브러리를 불러오지 못했습니다.\n\n' +
                '회사망에서 jsDelivr가 차단되었을 가능성이 있습니다.';

            return;
        }


        button.disabled = true;

        button.textContent = '변환 중...';

        logEl.textContent =
            '파일을 읽는 중입니다...';


        try {

            /*
             * 두 파일 읽기
             */

            const [
                baseBuffer,
                modBuffer
            ] =
                await Promise.all([
                    baseFile.arrayBuffer(),
                    modFile.arrayBuffer()
                ]);


            /*
             * XLSX 구조 분석
             */

            const baseXlsx =
                await loadXlsx(baseBuffer);


            const modXlsx =
                await loadXlsx(modBuffer);



            /*
             * 전체 통계
             */

            let processedSheets = 0;

            let totalBaseRows = 0;

            let totalMatched = 0;

            let totalMissing = 0;

            let totalExtraIgnored = 0;

            let totalDuplicateIgnored = 0;

            let totalWritten = 0;

            let totalBlank = 0;


            const logs = [];


            /*
             * 기준 파일의 Sheet만 순회
             */

            for (
                const [
                    sheetName,
                    basePath
                ]
                of baseXlsx.sheetMap.entries()
            ) {

                const baseXmlFile =
                    baseXlsx.zip.file(basePath);


                if (!baseXmlFile) {

                    continue;
                }


                const baseXml =
                    await baseXmlFile.async('string');


                const baseDoc =
                    parseXml(baseXml);


                const baseInfo =
                    analyzeSheet(
                        baseDoc,
                        baseXlsx.sharedStrings
                    );


                /*
                 * 한국어 이름이 없는 Sheet는 무시
                 */

                if (!baseInfo) {

                    continue;
                }


                if (
                    !baseInfo.headers.has(
                        KEY_HEADER
                    )
                ) {

                    continue;
                }


                /*
                 * 실제 존재하는 허용 열만 선택
                 */

                const allowed =
                    ALLOWED_HEADERS.filter(
                        header =>
                            baseInfo.headers.has(header)
                    );


                /*
                 * 변경 가능한 열이 하나도 없으면 무시
                 */

                if (allowed.length === 0) {

                    continue;
                }


                /*
                 * 수정 파일에 같은 Sheet가 있는지 확인
                 */

                const modPath =
                    modXlsx.sheetMap.get(sheetName);


                if (!modPath) {

                    throw new Error(
                        `수정 파일에 '${sheetName}' 탭이 없습니다.`
                    );
                }


                const modXmlFile =
                    modXlsx.zip.file(modPath);


                if (!modXmlFile) {

                    throw new Error(
                        `수정 파일의 '${sheetName}' 탭을 읽을 수 없습니다.`
                    );
                }


                const modXml =
                    await modXmlFile.async('string');


                const modDoc =
                    parseXml(modXml);


                const modInfo =
                    analyzeSheet(
                        modDoc,
                        modXlsx.sharedStrings
                    );


                /*
                 * 수정 파일의 한국어 이름 열 확인
                 */

                if (
                    !modInfo ||
                    !modInfo.headers.has(KEY_HEADER)
                ) {

                    throw new Error(
                        `'${sheetName}' 탭에서 ` +
                        `'${KEY_HEADER}' 열을 찾지 못했습니다.`
                    );
                }


                /*
                 * 필요한 번역 열 존재 여부 확인
                 */

                const missingColumns =
                    allowed.filter(
                        header =>
                            !modInfo.headers.has(header)
                    );


                if (missingColumns.length > 0) {

                    throw new Error(
                        `'${sheetName}' 탭의 수정 파일에 ` +
                        `필요한 열이 없습니다.\n\n` +
                        missingColumns.join('\n')
                    );
                }


                /*
                 * 수정 파일 Map 생성
                 *
                 * 한국어 이름
                 *      ↓
                 * 번역 / 설명
                 *
                 * 중복 한국어 이름은
                 * 첫 번째 값만 사용
                 */

                const modResult =
                    buildModifiedMap(
                        modInfo,
                        modXlsx.sharedStrings,
                        allowed
                    );


                const modMap =
                    modResult.map;


                /*
                 * 기준 파일 데이터 행
                 */

                const baseRows =
                    getDataRows(
                        baseInfo,
                        baseXlsx.sharedStrings
                    );


                const baseKeys =
                    new Set();


                let matched = 0;

                let missing = 0;

                let written = 0;

                let blanks = 0;



                /*
                 * ====================================================
                 * 가장 중요한 부분
                 *
                 * 수정 파일이 아니라
                 * 기준 파일만 순회
                 *
                 * 기준 150개
                 * 수정 151개
                 *
                 * 결과는 무조건 기준 150개
                 * ====================================================
                 */

                for (const row of baseRows) {

                    const key =
                        normalizeKey(
                            row.values.get(
                                KEY_HEADER
                            )
                        );


                    if (!key) {

                        continue;
                    }


                    baseKeys.add(key);


                    const source =
                        modMap.get(key);


                    if (source) {

                        matched++;

                    } else {

                        missing++;
                    }



                    /*
                     * 허용된 7개 열만 기록
                     */

                    for (
                        const header
                        of allowed
                    ) {

                        /*
                         * 수정 파일에 메뉴가 없으면 공란
                         *
                         * 수정 파일 값이 공란이면 공란
                         */

                        const value =
                            source
                                ? (
                                    source.get(header)
                                    ?? ''
                                )
                                : '';


                        const column =
                            baseInfo
                                .headers
                                .get(header);


                        /*
                         * 실제 문자열 값 직접 기록
                         *
                         * VLOOKUP/XLOOKUP 등의
                         * 수식은 생성하지 않음
                         */

                        setCellValue(
                            baseDoc,
                            row.rowNumber,
                            column,
                            String(
                                value ?? ''
                            )
                        );


                        written++;


                        if (
                            String(
                                value ?? ''
                            ) === ''
                        ) {

                            blanks++;
                        }
                    }
                }



                /*
                 * 수정 파일에만 존재하는 메뉴 계산
                 *
                 * 기준 파일에는 절대 추가하지 않음
                 */

                let extraIgnored = 0;


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
                 * 수정된 Sheet XML을
                 * 기준 파일에 저장
                 */

                const newXml =
                    new XMLSerializer()
                        .serializeToString(
                            baseDoc
                        );


                baseXlsx.zip.file(
                    basePath,
                    newXml
                );



                /*
                 * 통계
                 */

                processedSheets++;

                totalBaseRows +=
                    baseRows.length;

                totalMatched +=
                    matched;

                totalMissing +=
                    missing;

                totalExtraIgnored +=
                    extraIgnored;

                totalDuplicateIgnored +=
                    modResult.duplicateCount;

                totalWritten +=
                    written;

                totalBlank +=
                    blanks;



                /*
                 * Sheet별 로그
                 */

                let sheetLog =

                    `[${sheetName}]\n` +

                    `기준 데이터 : ${baseRows.length}\n` +

                    `정상 매칭 : ${matched}\n` +

                    `미매칭 : ${missing}\n` +

                    `추가 메뉴 무시 : ${extraIgnored}\n` +

                    `중복 이름 무시 : ${modResult.duplicateCount}\n` +

                    `기록 셀 : ${written}\n` +

                    `공란 처리 : ${blanks}`;


                if (
                    modResult.duplicateNames.length > 0
                ) {

                    sheetLog +=
                        '\n\n중복된 한국어 이름\n' +
                        modResult
                            .duplicateNames
                            .map(
                                name =>
                                    `- ${name}`
                            )
                            .join('\n');
                }


                logs.push(sheetLog);
            }



            /*
             * 처리 가능한 Sheet가 하나도 없는 경우
             */

            if (processedSheets === 0) {

                throw new Error(
                    `'한국어 이름'과 번역/설명 열이 있는 ` +
                    `탭을 찾지 못했습니다.`
                );
            }



            /*
             * ========================================================
             * 결과 파일 생성
             *
             * 기준 파일 자체를 기반으로 생성
             * ========================================================
             */

            const blob =
                await baseXlsx.zip.generateAsync({
                    type: 'blob',
                    mimeType:
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    compression: 'DEFLATE'
                });



            /*
             * 결과 파일 이름
             *
             * 원본:
             * 메뉴등록.xlsx
             *
             * 결과:
             * 메뉴등록_완성본.xlsx
             */

            const outputName =
                makeOutputName(
                    baseFile.name
                );



            /*
             * 다운로드
             */

            downloadBlob(
                blob,
                outputName
            );



            /*
             * 완료 로그
             */

            logEl.textContent =

                '변환 완료\n\n' +

                logs.join(
                    '\n\n--------------------\n\n'
                ) +

                '\n\n====================\n' +

                '전체 결과\n' +

                '====================\n' +

                `처리 탭 : ${processedSheets}\n` +

                `기준 데이터 : ${totalBaseRows}\n` +

                `정상 매칭 : ${totalMatched}\n` +

                `미매칭 : ${totalMissing}\n` +

                `추가 메뉴 무시 : ${totalExtraIgnored}\n` +

                `중복 이름 무시 : ${totalDuplicateIgnored}\n` +

                `기록 셀 : ${totalWritten}\n` +

                `공란 처리 : ${totalBlank}\n\n` +

                `저장 파일\n${outputName}\n\n` +

                '✓ 한국어 이름은 수정하지 않았습니다.\n' +

                '✓ 허용된 번역/설명 열만 기록했습니다.\n' +

                '✓ 수정 파일의 추가 메뉴는 넣지 않았습니다.\n' +

                '✓ 중복 한국어 이름은 첫 번째 값만 사용했습니다.\n' +

                '✓ 수식은 생성하지 않았습니다.';


        } catch (error) {

            console.error(error);


            logEl.textContent =

                '변환 실패\n\n' +

                (
                    error.message ||
                    String(error)
                );

        } finally {

            button.disabled = false;

            button.textContent =
                '변환하기';
        }
    }



    /*
     * ============================================================
     * XLSX 읽기
     * ============================================================
     */

    async function loadXlsx(buffer) {

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


        const workbookXml =
            await workbookFile.async(
                'string'
            );


        const relsXml =
            await relsFile.async(
                'string'
            );


        const workbookDoc =
            parseXml(
                workbookXml
            );


        const relsDoc =
            parseXml(
                relsXml
            );


        /*
         * 관계 ID → Sheet 경로
         */

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



        /*
         * Sheet 이름 → XML 경로
         */

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
                ) ||

                sheet.getAttributeNS(
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                    'id'
                );


            const target =
                relationMap.get(rid);


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



        /*
         * Shared Strings
         */

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

    async function readSharedStrings(zip) {

        const file =
            zip.file(
                'xl/sharedStrings.xml'
            );


        if (!file) {

            return [];
        }


        const xml =
            await file.async(
                'string'
            );


        const doc =
            parseXml(xml);


        const result = [];


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
                        node.textContent ||
                        ''
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
     * 헤더 찾기
     * ============================================================
     */

    function analyzeSheet(
        sheetDoc,
        sharedStrings
    ) {

        const rows =
            [
                ...sheetDoc
                    .getElementsByTagName(
                        'row'
                    )
            ];


        /*
         * 앞쪽 최대 30개 행에서
         * 헤더 검색
         */

        for (
            const row
            of rows.slice(
                0,
                MAX_HEADER_SCAN_ROWS
            )
        ) {

            const rowValues =
                getRowValues(
                    row,
                    sharedStrings
                );


            const headers =
                new Map();


            for (
                const [
                    column,
                    value
                ]
                of rowValues.entries()
            ) {

                const text =
                    String(
                        value ?? ''
                    ).trim();


                if (text) {

                    headers.set(
                        text,
                        column
                    );
                }
            }


            /*
             * 한국어 이름 필수
             */

            if (
                !headers.has(
                    KEY_HEADER
                )
            ) {

                continue;
            }


            /*
             * 번역/설명 열이 최소 하나 이상
             */

            if (
                !ALLOWED_HEADERS.some(
                    header =>
                        headers.has(header)
                )
            ) {

                continue;
            }


            return {

                sheetDoc,

                headerRowNumber:
                    Number(
                        row.getAttribute(
                            'r'
                        )
                    ) || 1,

                headers
            };
        }


        return null;
    }



    /*
     * ============================================================
     * 데이터 행 읽기
     * ============================================================
     */

    function getDataRows(
        info,
        sharedStrings
    ) {

        const rows =
            [
                ...info
                    .sheetDoc
                    .getElementsByTagName(
                        'row'
                    )
            ];


        const result = [];


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


            /*
             * 헤더 이전 행 무시
             */

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


            for (
                const [
                    header,
                    column
                ]
                of info.headers.entries()
            ) {

                values.set(
                    header,
                    rowValues.get(column)
                    ?? ''
                );
            }


            /*
             * 한국어 이름이 있는 행만 데이터로 취급
             */

            if (
                normalizeKey(
                    values.get(
                        KEY_HEADER
                    )
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
     * ============================================================
     * 수정 파일 Map 생성
     *
     * VLOOKUP과 동일하게
     * 중복 한국어 이름은 첫 번째 항목만 사용
     * ============================================================
     */

    function buildModifiedMap(
        info,
        sharedStrings,
        allowedHeaders
    ) {

        const rows =
            getDataRows(
                info,
                sharedStrings
            );


        const map =
            new Map();


        let duplicateCount = 0;


        const duplicateNames =
            [];


        const duplicateNameSet =
            new Set();



        for (
            const row
            of rows
        ) {

            const key =
                normalizeKey(
                    row.values.get(
                        KEY_HEADER
                    )
                );


            if (!key) {

                continue;
            }



            /*
             * 이미 같은 한국어 이름이 존재하면
             * 첫 번째 데이터를 유지하고
             * 이후 데이터는 무시
             */

            if (
                map.has(key)
            ) {

                duplicateCount++;


                if (
                    !duplicateNameSet.has(key)
                ) {

                    duplicateNameSet.add(key);

                    duplicateNames.push(
                        key
                    );
                }


                continue;
            }



            const data =
                new Map();


            for (
                const header
                of allowedHeaders
            ) {

                data.set(
                    header,
                    row.values.get(header)
                    ?? ''
                );
            }


            map.set(
                key,
                data
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
     * 행의 모든 셀 읽기
     * ============================================================
     */

    function getRowValues(
        row,
        sharedStrings
    ) {

        const map =
            new Map();


        const cells =
            [
                ...row
                    .getElementsByTagName(
                        'c'
                    )
            ];


        for (
            const cell
            of cells
        ) {

            const ref =
                cell.getAttribute(
                    'r'
                ) || '';


            const column =
                getColumnLetters(
                    ref
                );


            if (!column) {

                continue;
            }


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
     * ============================================================
     * 셀 문자열 읽기
     * ============================================================
     */

    function getCellText(
        cell,
        sharedStrings
    ) {

        const type =
            cell.getAttribute(
                't'
            );


        /*
         * Inline String
         */

        if (
            type === 'inlineStr'
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
                    valueNode.textContent
                    || ''
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


            return Number.isFinite(index)

                ? (
                    sharedStrings[index]
                    ?? ''
                )

                : '';
        }


        return raw;
    }



    /*
     * ============================================================
     * 셀 값 직접 기록
     *
     * 수식은 절대 만들지 않음
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
            [
                ...sheetDoc
                    .getElementsByTagName(
                        'row'
                    )
            ];


        let row =
            rows.find(
                currentRow =>
                    Number(
                        currentRow
                            .getAttribute(
                                'r'
                            )
                    ) === rowNumber
            );



        /*
         * 행이 없으면 생성
         */

        if (!row) {

            row =
                sheetDoc.createElementNS(
                    ns,
                    'row'
                );


            row.setAttribute(
                'r',
                String(
                    rowNumber
                )
            );


            const sheetData =
                sheetDoc
                    .getElementsByTagName(
                        'sheetData'
                    )[0];


            if (!sheetData) {

                throw new Error(
                    'Excel Sheet 구조가 올바르지 않습니다.'
                );
            }


            sheetData.appendChild(
                row
            );
        }



        const ref =
            `${column}${rowNumber}`;



        let cell =
            [
                ...row
                    .getElementsByTagName(
                        'c'
                    )
            ]

            .find(
                currentCell =>
                    currentCell.getAttribute(
                        'r'
                    ) === ref
            );



        /*
         * 셀이 없으면 생성
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
         * f  = formula
         * v  = value
         * is = inline string
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
         * 공란 처리
         */

        if (value === '') {

            cell.removeAttribute(
                't'
            );


            return;
        }



        /*
         * 실제 문자열 값 기록
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



        /*
         * 앞뒤 공백 보존
         */

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
     * 셀을 기존 열 순서에 맞게 삽입
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
     * XML 파싱
     * ============================================================
     */

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



    /*
     * ============================================================
     * XLSX 내부 경로 정리
     * ============================================================
     */

    function resolveXlPath(
        target
    ) {

        if (
            target.startsWith('/')
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


        return output.join('/');
    }



    /*
     * ============================================================
     * 셀 주소에서 열 문자 추출
     *
     * D10 → D
     * AA25 → AA
     * ============================================================
     */

    function getColumnLetters(
        ref
    ) {

        const match =
            String(ref)
                .match(
                    /^([A-Z]+)\d+$/i
                );


        return match

            ? match[1]
                .toUpperCase()

            : '';
    }



    /*
     * ============================================================
     * 열 문자 → 숫자
     *
     * A  = 1
     * B  = 2
     * AA = 27
     * ============================================================
     */

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
                    char.charCodeAt(0)
                    - 64
                );
        }


        return result;
    }



    /*
     * ============================================================
     * 한국어 이름 비교용
     *
     * 앞뒤 공백만 제거
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
     * ============================================================
     * 결과 파일 이름
     *
     * 예:
     *
     * 메뉴등록.xlsx
     * →
     * 메뉴등록_완성본.xlsx
     *
     * 메뉴등록.xlsm
     * →
     * 메뉴등록_완성본.xlsm
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
     * 파일 다운로드
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
            () => {

                URL.revokeObjectURL(
                    url
                );

            },
            3000
        );
    }

})();
