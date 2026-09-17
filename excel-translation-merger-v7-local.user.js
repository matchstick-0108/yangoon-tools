// ==UserScript==
// @name         메뉴잇 번역본 병합기 AUTO LOCAL v7
// @namespace    yangoon.menuit.translation
// @version      0.7.0
// @description  외부 통신 없이 고객 번역본 A를 현재 기준파일 B에 로컬 병합합니다.
// @match        https://argos.skshieldus.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const TOOL_NAME = '메뉴잇 번역본 병합기 AUTO LOCAL';
    const MAX_HEADER_SCAN_ROWS = 20;

    /*
     * A = 고객이 번역해서 돌려준 파일
     * B = 현재 시점의 기준파일
     *
     * 최종 구조는 무조건 B 기준
     *
     * A에 번역값 있음 → A 사용
     * A가 공란 → B 유지
     * A에만 있는 행 → 무시
     * B에만 있는 행 → B 유지
     *
     * ID / 가격 / POS / 순서 등은 수정하지 않음
     */

    const SHEET_CONFIGS = {
        '카테고리': {
            key: 'ko_name',
            id: 'category_id',
            parent: null,
            context: null,
            targets: [
                'en_name',
                'zh_name',
                'ja_name',
                'ru_name',
                'ko_desc',
                'en_desc',
                'zh_desc',
                'ja_desc',
                'ru_desc'
            ]
        },

        '메뉴': {
            key: 'ko_name',
            id: 'menu_id',
            parent: 'category_id',
            context: 'menu_category',
            targets: [
                'en_name',
                'zh_name',
                'ja_name',
                'ru_name',
                'ko_desc',
                'en_desc',
                'zh_desc',
                'ja_desc',
                'ru_desc'
            ]
        },

        '옵션': {
            key: 'ko_option',
            id: 'option_id',
            parent: 'menu_id',
            context: null,
            targets: [
                'en_option',
                'zh_option',
                'ja_option',
                'ru_option'
            ]
        },

        '옵션아이템': {
            key: 'ko_option_item',
            id: 'option_item_id',
            parent: 'option_id',
            context: null,
            targets: [
                'en_option_item',
                'zh_option_item',
                'ja_option_item',
                'ru_option_item'
            ]
        }
    };


    const DISPLAY_NAMES = {
        en_name: '영어 이름',
        zh_name: '중국어 이름',
        ja_name: '일본어 이름',
        ru_name: '러시아어 이름',

        ko_desc: '한국어 설명',
        en_desc: '영어 설명',
        zh_desc: '중국어 설명',
        ja_desc: '일본어 설명',
        ru_desc: '러시아어 설명',

        en_option: '영어 옵션명',
        zh_option: '중국어 옵션명',
        ja_option: '일본어 옵션명',
        ru_option: '러시아어 옵션명',

        en_option_item: '영어 옵션아이템명',
        zh_option_item: '중국어 옵션아이템명',
        ja_option_item: '일본어 옵션아이템명',
        ru_option_item: '러시아어 옵션아이템명'
    };


    let panel = null;


    /*
     * Ctrl + Shift + E
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
     * UI
     */

    function togglePanel() {

        if (panel) {

            panel.remove();

            panel = null;

            return;
        }


        panel =
            document.createElement(
                'div'
            );


        panel.innerHTML = `

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                padding:12px;
                background:#eee;
                border-bottom:1px solid #ccc;
            ">

                <b style="font-size:16px;">
                    ${TOOL_NAME}
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
                    background:#f6f6f6;
                    border:1px solid #ddd;
                    padding:10px;
                    margin-bottom:14px;
                    line-height:1.65;
                ">

                    <b>A = 고객 번역본</b>
                    (번역값 공급)

                    <br>

                    <b>B = 현재 기준파일</b>
                    (최종 구조 기준)

                    <br><br>

                    B의 탭·행·순서·ID·가격 등은 그대로 유지하고,

                    <br>

                    A의 <b>번역 이름/설명 값만</b>
                    병합합니다.

                    <br><br>

                    <b>외부 서버 전송 없음 / 완전 로컬 처리</b>

                </div>


                <b>
                    1. 고객 번역본 A
                </b>

                <br>

                <input
                    id="yg-a"
                    type="file"
                    accept=".xlsx,.xlsm"
                    style="
                        width:100%;
                        margin:7px 0 14px;
                    "
                >


                <b>
                    2. 현재 기준파일 B
                </b>

                <br>

                <input
                    id="yg-b"
                    type="file"
                    accept=".xlsx,.xlsm"
                    style="
                        width:100%;
                        margin:7px 0 14px;
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
                    번역 병합하기
                </button>


                <pre
                    id="yg-log"
                    style="
                        background:#111;
                        color:#eee;
                        padding:12px;
                        margin-top:14px;
                        min-height:145px;
                        max-height:390px;
                        overflow:auto;
                        white-space:pre-wrap;
                        line-height:1.55;
                    "
                >A와 B 파일을 선택하세요.</pre>

            </div>
        `;


        Object.assign(
            panel.style,
            {
                position: 'fixed',
                zIndex: '2147483647',
                top: '20px',
                right: '20px',
                width: '490px',
                maxHeight: '90vh',
                overflow: 'auto',
                background: '#fff',
                color: '#111',
                border: '1px solid #777',
                borderRadius: '10px',
                boxShadow:
                    '0 8px 28px rgba(0,0,0,.28)',
                fontFamily:
                    'Arial, sans-serif',
                fontSize: '13px'
            }
        );


        document.body.appendChild(
            panel
        );


        panel
            .querySelector(
                '#yg-close'
            )
            .addEventListener(
                'click',
                togglePanel
            );


        panel
            .querySelector(
                '#yg-run'
            )
            .addEventListener(
                'click',
                runMerge
            );
    }


    /*
     * 병합 실행
     */

    async function runMerge() {

        const logEl =
            panel.querySelector(
                '#yg-log'
            );


        const button =
            panel.querySelector(
                '#yg-run'
            );


        const aFile =
            panel
                .querySelector(
                    '#yg-a'
                )
                .files[0];


        const bFile =
            panel
                .querySelector(
                    '#yg-b'
                )
                .files[0];


        if (
            !aFile ||
            !bFile
        ) {

            logEl.textContent =
                '고객 번역본 A와 현재 기준파일 B를 모두 선택하세요.';

            return;
        }


        /*
         * Edge 내장 ZIP 압축 해제 기능
         */

        if (
            typeof DecompressionStream ===
            'undefined'
        ) {

            logEl.textContent =
                '이 Edge 버전은 로컬 XLSX 압축 해제를 지원하지 않습니다.\n' +
                'Edge 업데이트가 필요합니다.';

            return;
        }


        button.disabled = true;

        button.textContent =
            '병합 중...';


        logEl.textContent =
            '파일을 로컬에서 읽고 탭/헤더를 분석하고 있습니다...';


        try {

            const [
                aBuffer,
                bBuffer
            ] =
                await Promise.all([
                    aFile.arrayBuffer(),
                    bFile.arrayBuffer()
                ]);


            const aBook =
                await loadXlsx(
                    aBuffer
                );


            const bBook =
                await loadXlsx(
                    bBuffer
                );


            let totalBRows = 0;

            let totalMatchedRows = 0;

            let totalBOnlyRows = 0;

            let totalAOnlyIgnored = 0;

            let totalChangedCells = 0;

            let totalAblankKeptB = 0;

            let totalSameValues = 0;

            let totalAmbiguous = 0;

            let processedSheets = 0;


            const sheetLogs =
                [];


            /*
             * 카테고리 / 메뉴 / 옵션 / 옵션아이템
             */

            for (
                const [
                    sheetName,
                    config
                ]
                of Object.entries(
                    SHEET_CONFIGS
                )
            ) {

                /*
                 * B가 최종 구조 기준
                 */

                const bPath =
                    bBook
                        .sheetMap
                        .get(
                            sheetName
                        );


                if (!bPath) {

                    sheetLogs.push(
                        `[${sheetName}]\n` +
                        `B에 탭 없음 → 건너뜀`
                    );

                    continue;
                }


                const aPath =
                    aBook
                        .sheetMap
                        .get(
                            sheetName
                        );


                /*
                 * A에 해당 탭이 없으면
                 * B 그대로
                 */

                if (!aPath) {

                    sheetLogs.push(
                        `[${sheetName}]\n` +
                        `A에 탭 없음 → B 그대로 유지`
                    );

                    continue;
                }


                const bXml =
                    bBook
                        .zip
                        .getText(
                            bPath
                        );


                const aXml =
                    aBook
                        .zip
                        .getText(
                            aPath
                        );


                if (
                    bXml == null ||
                    aXml == null
                ) {

                    throw new Error(
                        `[${sheetName}] 내부 Sheet XML을 읽을 수 없습니다.`
                    );
                }


                const bDoc =
                    parseXml(
                        bXml
                    );


                const aDoc =
                    parseXml(
                        aXml
                    );


                /*
                 * 열 위치가 아닌
                 * 헤더명으로 찾음
                 */

                const bHeader =
                    findHeaderInfo(
                        bDoc,
                        bBook.sharedStrings,
                        config.key
                    );


                const aHeader =
                    findHeaderInfo(
                        aDoc,
                        aBook.sharedStrings,
                        config.key
                    );


                if (!bHeader) {

                    throw new Error(
                        `[${sheetName}] B에서 한국어 기준 헤더를 찾지 못했습니다.`
                    );
                }


                if (!aHeader) {

                    sheetLogs.push(
                        `[${sheetName}]\n` +
                        `A에서 한국어 기준 헤더를 찾지 못함 → B 그대로 유지`
                    );

                    continue;
                }


                /*
                 * B에 존재하는 번역 헤더만 처리
                 *
                 * 러시아어가 있으면 자동 포함
                 */

                const bTargets =
                    config.targets.filter(
                        target =>
                            bHeader
                                .columns
                                .has(
                                    target
                                )
                    );


                if (
                    bTargets.length ===
                    0
                ) {

                    sheetLogs.push(
                        `[${sheetName}]\n` +
                        `B에 처리할 번역 헤더 없음 → 건너뜀`
                    );

                    continue;
                }


                const aMissingTargets =
                    bTargets.filter(
                        target =>
                            !aHeader
                                .columns
                                .has(
                                    target
                                )
                    );


                const commonTargets =
                    bTargets.filter(
                        target =>
                            aHeader
                                .columns
                                .has(
                                    target
                                )
                    );


                const aRows =
                    extractRows(
                        aDoc,
                        aBook.sharedStrings,
                        aHeader,
                        config,
                        commonTargets
                    );


                const bRows =
                    extractRows(
                        bDoc,
                        bBook.sharedStrings,
                        bHeader,
                        config,
                        bTargets
                    );


                /*
                 * A를 한국어 기준값으로 그룹화
                 */

                const aByKey =
                    new Map();


                for (
                    const row
                    of aRows
                ) {

                    if (
                        !aByKey.has(
                            row.key
                        )
                    ) {

                        aByKey.set(
                            row.key,
                            []
                        );
                    }


                    aByKey
                        .get(
                            row.key
                        )
                        .push(
                            row
                        );
                }


                /*
                 * 같은 A행을 두 번 쓰지 않음
                 */

                const usedA =
                    new Set();


                let matchedRows = 0;

                let bOnlyRows = 0;

                let changedCells = 0;

                let aBlankKeptB = 0;

                let sameValues = 0;

                let ambiguous = 0;


                const ambiguousNames =
                    new Set();


                const changedByTarget =
                    new Map();


                for (
                    const target
                    of bTargets
                ) {

                    changedByTarget.set(
                        target,
                        0
                    );
                }


                /*
                 * 무조건 B의 행만 순회
                 */

                for (
                    const bRow
                    of bRows
                ) {

                    const match =
                        chooseARow(

                            bRow,

                            aByKey.get(
                                bRow.key
                            )
                            || [],

                            usedA
                        );


                    /*
                     * B에만 있는 데이터
                     * → B 그대로 유지
                     */

                    if (!match.row) {

                        bOnlyRows++;

                        continue;
                    }


                    const aRow =
                        match.row;


                    usedA.add(
                        aRow.rowNumber
                    );


                    matchedRows++;


                    if (
                        match.ambiguous
                    ) {

                        ambiguous++;

                        ambiguousNames.add(
                            bRow.key
                        );
                    }


                    /*
                     * 번역 데이터 병합
                     */

                    for (
                        const target
                        of bTargets
                    ) {

                        /*
                         * A에 해당 열 자체가 없으면
                         * B 유지
                         */

                        if (
                            !aHeader
                                .columns
                                .has(
                                    target
                                )
                        ) {

                            continue;
                        }


                        const aValue =
                            aRow
                                .values
                                .get(
                                    target
                                )
                            ?? '';


                        /*
                         * A 셀이 공란이면
                         * B 유지
                         */

                        if (
                            !hasText(
                                aValue
                            )
                        ) {

                            aBlankKeptB++;

                            continue;
                        }


                        const bValue =
                            bRow
                                .values
                                .get(
                                    target
                                )
                            ?? '';


                        const aText =
                            String(
                                aValue
                            );


                        const bText =
                            String(
                                bValue
                            );


                        const bColumn =
                            bHeader
                                .columns
                                .get(
                                    target
                                );


                        const bCell =
                            findCellByColumn(
                                bRow.row,
                                bColumn
                            );


                        /*
                         * 값이 같고 수식도 없으면
                         * 건드리지 않음
                         */

                        if (
                            aText === bText &&
                            !cellHasFormula(
                                bCell
                            )
                        ) {

                            sameValues++;

                            continue;
                        }


                        /*
                         * A 값으로 B의
                         * 번역 대상 셀만 변경
                         */

                        setCellValue(

                            bDoc,

                            bRow.rowNumber,

                            bColumn,

                            aText
                        );


                        changedCells++;


                        changedByTarget.set(

                            target,

                            (
                                changedByTarget.get(
                                    target
                                )
                                || 0
                            )
                            + 1
                        );
                    }
                }


                /*
                 * A에만 있고 B에는 없는 행
                 * → 결과에 추가 안 함
                 */

                const aOnlyIgnored =
                    aRows.length -
                    usedA.size;


                if (
                    changedCells > 0
                ) {

                    const newXml =
                        new XMLSerializer()
                            .serializeToString(
                                bDoc
                            );


                    bBook
                        .zip
                        .setText(
                            bPath,
                            newXml
                        );
                }


                processedSheets++;

                totalBRows +=
                    bRows.length;

                totalMatchedRows +=
                    matchedRows;

                totalBOnlyRows +=
                    bOnlyRows;

                totalAOnlyIgnored +=
                    aOnlyIgnored;

                totalChangedCells +=
                    changedCells;

                totalAblankKeptB +=
                    aBlankKeptB;

                totalSameValues +=
                    sameValues;

                totalAmbiguous +=
                    ambiguous;


                const changedLines =
                    bTargets
                        .map(
                            target =>
                                `${
                                    DISPLAY_NAMES[
                                        target
                                    ]
                                    || target
                                }: ${
                                    changedByTarget.get(
                                        target
                                    )
                                    || 0
                                }`
                        )
                        .join(
                            '\n'
                        );


                let log =

                    `[${sheetName}]\n` +

                    `B 기준 행: ${bRows.length}\n` +

                    `A와 매칭: ${matchedRows}\n` +

                    `B에만 있음(유지): ${bOnlyRows}\n` +

                    `A에만 있음(무시): ${aOnlyIgnored}\n` +

                    `실제 변경 셀: ${changedCells}\n` +

                    `A 공란이라 B 유지: ${aBlankKeptB}\n` +

                    `A/B 동일값: ${sameValues}\n` +

                    `중복명 보조매칭: ${ambiguous}`;


                if (
                    aMissingTargets.length >
                    0
                ) {

                    log +=
                        '\nA에 없는 번역 열(B 유지): '
                        +
                        aMissingTargets
                            .map(
                                target =>
                                    DISPLAY_NAMES[
                                        target
                                    ]
                                    || target
                            )
                            .join(
                                ', '
                            );
                }


                if (
                    ambiguousNames.size >
                    0
                ) {

                    log +=
                        '\n중복명 확인 필요: '
                        +
                        Array
                            .from(
                                ambiguousNames
                            )
                            .slice(
                                0,
                                10
                            )
                            .join(
                                ', '
                            );


                    if (
                        ambiguousNames.size >
                        10
                    ) {

                        log +=
                            ` 외 ${
                                ambiguousNames.size
                                - 10
                            }개`;
                    }
                }


                log +=
                    '\n\n항목별 변경\n'
                    +
                    changedLines;


                sheetLogs.push(
                    log
                );
            }


            if (
                processedSheets ===
                0
            ) {

                throw new Error(
                    '처리 가능한 표준 탭을 찾지 못했습니다.'
                );
            }


            /*
             * 완성본 생성
             */

            const outputName =
                makeOutputName(
                    bFile.name
                );


            const zipBytes =
                bBook
                    .zip
                    .generate();


            const blob =
                new Blob(
                    [zipBytes],
                    {
                        type:
                            getMimeType(
                                bFile.name
                            )
                    }
                );


            downloadBlob(
                blob,
                outputName
            );


            logEl.textContent =

                '병합 완료\n\n'

                +

                sheetLogs.join(
                    '\n\n====================\n\n'
                )

                +

                '\n\n####################\n'

                +

                '전체 결과\n'

                +

                '####################\n'

                +

                `처리 탭: ${processedSheets}\n`

                +

                `B 기준 행: ${totalBRows}\n`

                +

                `A와 매칭: ${totalMatchedRows}\n`

                +

                `B에만 있음(유지): ${totalBOnlyRows}\n`

                +

                `A에만 있음(무시): ${totalAOnlyIgnored}\n`

                +

                `실제 변경 셀: ${totalChangedCells}\n`

                +

                `A 공란이라 B 유지: ${totalAblankKeptB}\n`

                +

                `A/B 동일값: ${totalSameValues}\n`

                +

                `중복명 보조매칭: ${totalAmbiguous}\n\n`

                +

                `저장 파일\n${outputName}\n\n`

                +

                '✓ 완전 로컬 처리\n'

                +

                '✓ 최종 구조는 B 그대로\n'

                +

                '✓ A의 비어있지 않은 번역값 우선\n'

                +

                '✓ A 공란이면 B 값 유지\n'

                +

                '✓ A 추가 행은 결과에 추가하지 않음\n'

                +

                '✓ ID/가격/POS/순서 등은 수정하지 않음\n'

                +

                '✓ 수식이 아닌 실제 값으로 기록';


        } catch (
            error
        ) {

            console.error(
                error
            );


            logEl.textContent =

                '병합 실패\n\n'

                +

                (
                    error.message
                    ||
                    String(
                        error
                    )
                );

        } finally {

            button.disabled =
                false;


            button.textContent =
                '번역 병합하기';
        }
    }


    /*
     * 중복 한국어명 대응
     */

    function chooseARow(
        bRow,
        candidates,
        usedA
    ) {

        const unused =
            candidates.filter(
                row =>
                    !usedA.has(
                        row.rowNumber
                    )
            );


        if (
            unused.length ===
            0
        ) {

            return {
                row: null,
                ambiguous: false
            };
        }


        /*
         * 1. ID 일치
         */

        if (
            hasText(
                bRow.id
            )
        ) {

            const exactId =
                unused.filter(
                    row =>
                        hasText(
                            row.id
                        )
                        &&
                        String(
                            row.id
                        )
                        ===
                        String(
                            bRow.id
                        )
                );


            if (
                exactId.length ===
                1
            ) {

                return {
                    row: exactId[0],
                    ambiguous: false
                };
            }
        }


        /*
         * 2. 부모 ID 일치
         */

        if (
            hasText(
                bRow.parent
            )
        ) {

            const exactParent =
                unused.filter(
                    row =>
                        hasText(
                            row.parent
                        )
                        &&
                        String(
                            row.parent
                        )
                        ===
                        String(
                            bRow.parent
                        )
                );


            if (
                exactParent.length ===
                1
            ) {

                return {
                    row: exactParent[0],
                    ambiguous: false
                };
            }
        }


        /*
         * 3. 카테고리 등의 문맥 일치
         */

        if (
            hasText(
                bRow.context
            )
        ) {

            const exactContext =
                unused.filter(
                    row =>
                        normalizeKey(
                            row.context
                        )
                        ===
                        normalizeKey(
                            bRow.context
                        )
                );


            if (
                exactContext.length ===
                1
            ) {

                return {
                    row: exactContext[0],
                    ambiguous: false
                };
            }
        }


        /*
         * 4. 후보가 하나면 사용
         */

        if (
            unused.length ===
            1
        ) {

            return {
                row: unused[0],
                ambiguous: false
            };
        }


        /*
         * 5. 중복이면 등장 순서 기준
         * 로그에 경고
         */

        return {
            row: unused[0],
            ambiguous: true
        };
    }


    /*
     * 행 추출
     */

    function extractRows(
        sheetDoc,
        sharedStrings,
        headerInfo,
        config,
        targets
    ) {

        const rows =
            getRows(
                sheetDoc
            );


        const result =
            [];


        for (
            const row
            of rows
        ) {

            const rowNumber =
                Number(
                    row.getAttribute(
                        'r'
                    )
                )
                || 0;


            if (
                rowNumber <=
                headerInfo.rowNumber
            ) {

                continue;
            }


            const keyColumn =
                headerInfo
                    .columns
                    .get(
                        config.key
                    );


            const key =
                normalizeKey(
                    readCellByColumn(
                        row,
                        keyColumn,
                        sharedStrings
                    )
                );


            if (!key) {

                continue;
            }


            const values =
                new Map();


            for (
                const target
                of targets
            ) {

                const column =
                    headerInfo
                        .columns
                        .get(
                            target
                        );


                values.set(

                    target,

                    column
                        ?
                        readCellByColumn(
                            row,
                            column,
                            sharedStrings
                        )
                        :
                        ''
                );
            }


            result.push({

                row,

                rowNumber,

                key,

                id:
                    readCanonicalValue(
                        row,
                        headerInfo,
                        config.id,
                        sharedStrings
                    ),

                parent:
                    readCanonicalValue(
                        row,
                        headerInfo,
                        config.parent,
                        sharedStrings
                    ),

                context:
                    readCanonicalValue(
                        row,
                        headerInfo,
                        config.context,
                        sharedStrings
                    ),

                values
            });
        }


        return result;
    }


    function readCanonicalValue(
        row,
        headerInfo,
        canonical,
        sharedStrings
    ) {

        if (
            !canonical
            ||
            !headerInfo
                .columns
                .has(
                    canonical
                )
        ) {

            return '';
        }


        return readCellByColumn(

            row,

            headerInfo
                .columns
                .get(
                    canonical
                ),

            sharedStrings
        );
    }


    /*
     * 헤더 자동 검색
     */

    function findHeaderInfo(
        sheetDoc,
        sharedStrings,
        requiredKey
    ) {

        const rows =
            getRows(
                sheetDoc
            )
            .slice(
                0,
                MAX_HEADER_SCAN_ROWS
            );


        for (
            const row
            of rows
        ) {

            const columns =
                new Map();


            for (
                const cell
                of Array.from(
                    row
                        .getElementsByTagName(
                            'c'
                        )
                )
            ) {

                const column =
                    getColumnLetters(
                        cell.getAttribute(
                            'r'
                        )
                        || ''
                    );


                if (!column) {

                    continue;
                }


                const raw =
                    getCellText(
                        cell,
                        sharedStrings
                    );


                const canonical =
                    canonicalHeader(
                        raw
                    );


                if (
                    !canonical
                    ||
                    columns.has(
                        canonical
                    )
                ) {

                    continue;
                }


                columns.set(
                    canonical,
                    column
                );
            }


            if (
                columns.has(
                    requiredKey
                )
            ) {

                return {

                    rowNumber:
                        Number(
                            row.getAttribute(
                                'r'
                            )
                        )
                        || 1,

                    columns
                };
            }
        }


        return null;
    }


    /*
     * 실제 헤더명 → 내부 공통명
     */

    function canonicalHeader(
        value
    ) {

        const compact =
            normalizeHeaderText(
                value
            )
            .replace(
                /\s+/g,
                ''
            );


        if (!compact) {

            return null;
        }


        /*
         * ID 계열
         */

        if (
            /^카테고리ID/i.test(
                compact
            )
        ) {

            return 'category_id';
        }


        if (
            /^메뉴ID/i.test(
                compact
            )
        ) {

            return 'menu_id';
        }


        if (
            /^옵션아이템ID/i.test(
                compact
            )
        ) {

            return 'option_item_id';
        }


        if (
            /^옵션ID/i.test(
                compact
            )
        ) {

            return 'option_id';
        }


        if (
            compact ===
            '메뉴카테고리'
        ) {

            return 'menu_category';
        }


        /*
         * 카테고리 / 메뉴
         */

        const simple = {

            '한국어이름':
                'ko_name',

            '영어이름':
                'en_name',

            '중국어이름':
                'zh_name',

            '일본어이름':
                'ja_name',

            '러시아어이름':
                'ru_name',

            '한국어설명':
                'ko_desc',

            '영어설명':
                'en_desc',

            '중국어설명':
                'zh_desc',

            '일본어설명':
                'ja_desc',

            '러시아어설명':
                'ru_desc'
        };


        if (
            simple[
                compact
            ]
        ) {

            return simple[
                compact
            ];
        }


        /*
         * 옵션
         */

        if (
            /^\(한국어\)옵션명(?:\(선택분류명\))?$/.test(
                compact
            )
        ) {

            return 'ko_option';
        }


        if (
            /^\(영어\)옵션명$/.test(
                compact
            )
        ) {

            return 'en_option';
        }


        if (
            /^\(중국어\)옵션명$/.test(
                compact
            )
        ) {

            return 'zh_option';
        }


        if (
            /^\(일본어\)옵션명$/.test(
                compact
            )
        ) {

            return 'ja_option';
        }


        if (
            /^\(러시아어\)옵션명$/.test(
                compact
            )
        ) {

            return 'ru_option';
        }


        /*
         * 옵션 아이템
         */

        if (
            /^\(한국어\)옵션아이템명$/.test(
                compact
            )
        ) {

            return 'ko_option_item';
        }


        if (
            /^\(영어\)옵션아이템명$/.test(
                compact
            )
        ) {

            return 'en_option_item';
        }


        if (
            /^\(중국어\)옵션아이템명$/.test(
                compact
            )
        ) {

            return 'zh_option_item';
        }


        if (
            /^\(일본어\)옵션아이템명$/.test(
                compact
            )
        ) {

            return 'ja_option_item';
        }


        if (
            /^\(러시아어\)옵션아이템명$/.test(
                compact
            )
        ) {

            return 'ru_option_item';
        }


        return null;
    }


    function normalizeHeaderText(
        value
    ) {

        return String(
            value ?? ''
        )

        .replace(
            /_x000D_/gi,
            ' '
        )

        .replace(
            /\r\n|\r|\n/g,
            ' '
        )

        .replace(
            /\u00a0/g,
            ' '
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim()

        .normalize(
            'NFC'
        );
    }


    function normalizeKey(
        value
    ) {

        return String(
            value ?? ''
        )

        .replace(
            /_x000D_/gi,
            ' '
        )

        .replace(
            /\r\n|\r|\n/g,
            ' '
        )

        .replace(
            /\u00a0/g,
            ' '
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim()

        .normalize(
            'NFC'
        );
    }


    function hasText(
        value
    ) {

        return String(
            value ?? ''
        )
        .trim()
        .length > 0;
    }


    function getRows(
        sheetDoc
    ) {

        return Array.from(
            sheetDoc
                .getElementsByTagName(
                    'row'
                )
        );
    }


    function findCellByColumn(
        row,
        column
    ) {

        if (!column) {

            return null;
        }


        return (

            Array.from(
                row
                    .getElementsByTagName(
                        'c'
                    )
            )

            .find(
                cell =>
                    getColumnLetters(
                        cell.getAttribute(
                            'r'
                        )
                        || ''
                    )
                    ===
                    column
            )

            ||

            null
        );
    }


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


        return cell
            ?
            getCellText(
                cell,
                sharedStrings
            )
            :
            '';
    }


    /*
     * Excel 셀 값 읽기
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


        if (
            type ===
            'inlineStr'
        ) {

            return Array.from(
                cell
                    .getElementsByTagName(
                        't'
                    )
            )

            .map(
                node =>
                    node.textContent
                    || ''
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
                ?
                (
                    valueNode.textContent
                    || ''
                )
                :
                '';


        if (
            type === 's'
        ) {

            const index =
                Number(
                    raw
                );


            return Number.isFinite(
                index
            )
                ?
                (
                    sharedStrings[
                        index
                    ]
                    ?? ''
                )
                :
                '';
        }


        return raw;
    }


    function cellHasFormula(
        cell
    ) {

        return (
            !!cell
            &&
            cell
                .getElementsByTagName(
                    'f'
                )
                .length > 0
        );
    }


    /*
     * 수식이 아닌 실제 값 기록
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


        const row =
            getRows(
                sheetDoc
            )
            .find(
                current =>
                    Number(
                        current.getAttribute(
                            'r'
                        )
                    )
                    ===
                    rowNumber
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


        if (!cell) {

            cell =
                sheetDoc
                    .createElementNS(
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
         * 스타일 등 기존 속성은 유지
         * 값/수식만 제거
         */

        for (
            const tag
            of [
                'f',
                'v',
                'is'
            ]
        ) {

            for (
                const node
                of Array.from(
                    cell
                        .getElementsByTagName(
                            tag
                        )
                )
            ) {

                node.remove();
            }
        }


        if (
            value === ''
        ) {

            cell.removeAttribute(
                't'
            );

            return;
        }


        cell.setAttribute(
            't',
            'inlineStr'
        );


        const is =
            sheetDoc
                .createElementNS(
                    ns,
                    'is'
                );


        const text =
            sheetDoc
                .createElementNS(
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
                    || ''
                )
            );


        const cells =
            Array.from(
                row
                    .getElementsByTagName(
                        'c'
                    )
            );


        const before =
            cells.find(
                cell =>
                    columnToNumber(
                        getColumnLetters(
                            cell.getAttribute(
                                'r'
                            )
                            || ''
                        )
                    )
                    >
                    newColumn
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
     * XLSX 로드
     */

    async function loadXlsx(
        buffer
    ) {

        const zip =
            await LocalZip.load(
                buffer
            );


        const workbookXml =
            zip.getText(
                'xl/workbook.xml'
            );


        const relsXml =
            zip.getText(
                'xl/_rels/workbook.xml.rels'
            );


        if (
            workbookXml == null ||
            relsXml == null
        ) {

            throw new Error(
                '정상적인 XLSX/XLSM 파일이 아닙니다.'
            );
        }


        const workbookDoc =
            parseXml(
                workbookXml
            );


        const relsDoc =
            parseXml(
                relsXml
            );


        const relationMap =
            new Map();


        for (
            const relation
            of Array.from(
                relsDoc
                    .getElementsByTagName(
                        'Relationship'
                    )
            )
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
            of Array.from(
                workbookDoc
                    .getElementsByTagName(
                        'sheet'
                    )
            )
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


        return {

            zip,

            sheetMap,

            sharedStrings:
                readSharedStrings(
                    zip
                )
        };
    }


    function readSharedStrings(
        zip
    ) {

        const xml =
            zip.getText(
                'xl/sharedStrings.xml'
            );


        if (
            xml == null
        ) {

            return [];
        }


        const doc =
            parseXml(
                xml
            );


        const result =
            [];


        for (
            const si
            of Array.from(
                doc
                    .getElementsByTagName(
                        'si'
                    )
            )
        ) {

            result.push(

                Array.from(
                    si
                        .getElementsByTagName(
                            't'
                        )
                )

                .map(
                    node =>
                        node.textContent
                        || ''
                )

                .join('')
            );
        }


        return result;
    }


    /*
     * ==========================================================
     * 완전 로컬 ZIP 엔진
     *
     * 외부 라이브러리 사용 없음
     * 외부 서버 접속 없음
     *
     * XLSX = ZIP 구조이므로
     * Edge 내장 DecompressionStream으로 압축 해제
     * 결과는 ZIP STORE 방식으로 다시 생성
     * ==========================================================
     */

    class LocalZip {

        constructor(
            entries
        ) {

            this.entries =
                entries;
        }


        static async load(
            buffer
        ) {

            const bytes =
                new Uint8Array(
                    buffer
                );


            const view =
                new DataView(
                    bytes.buffer,
                    bytes.byteOffset,
                    bytes.byteLength
                );


            const eocd =
                findEndOfCentralDirectory(
                    bytes
                );


            const entryCount =
                view.getUint16(
                    eocd + 10,
                    true
                );


            const centralOffset =
                view.getUint32(
                    eocd + 16,
                    true
                );


            /*
             * 일반 XLSX만 처리
             */

            if (
                entryCount ===
                0xffff
                ||
                centralOffset ===
                0xffffffff
            ) {

                throw new Error(
                    'ZIP64 형식 XLSX는 지원하지 않습니다.'
                );
            }


            const decoder =
                new TextDecoder(
                    'utf-8'
                );


            const entries =
                new Map();


            let position =
                centralOffset;


            for (
                let i = 0;
                i < entryCount;
                i++
            ) {

                if (
                    view.getUint32(
                        position,
                        true
                    )
                    !==
                    0x02014b50
                ) {

                    throw new Error(
                        'XLSX ZIP 중앙 디렉터리를 읽을 수 없습니다.'
                    );
                }


                const flags =
                    view.getUint16(
                        position + 8,
                        true
                    );


                const method =
                    view.getUint16(
                        position + 10,
                        true
                    );


                const modTime =
                    view.getUint16(
                        position + 12,
                        true
                    );


                const modDate =
                    view.getUint16(
                        position + 14,
                        true
                    );


                const compressedSize =
                    view.getUint32(
                        position + 20,
                        true
                    );


                const uncompressedSize =
                    view.getUint32(
                        position + 24,
                        true
                    );


                const nameLength =
                    view.getUint16(
                        position + 28,
                        true
                    );


                const extraLength =
                    view.getUint16(
                        position + 30,
                        true
                    );


                const commentLength =
                    view.getUint16(
                        position + 32,
                        true
                    );


                const localOffset =
                    view.getUint32(
                        position + 42,
                        true
                    );


                /*
                 * 암호화 파일 차단
                 */

                if (
                    flags &
                    0x0001
                ) {

                    throw new Error(
                        '암호화된 XLSX는 처리할 수 없습니다.'
                    );
                }


                const name =
                    decoder.decode(

                        bytes.slice(

                            position + 46,

                            position +
                            46 +
                            nameLength
                        )
                    );


                if (
                    view.getUint32(
                        localOffset,
                        true
                    )
                    !==
                    0x04034b50
                ) {

                    throw new Error(
                        `XLSX ZIP 로컬 헤더 오류: ${name}`
                    );
                }


                const localNameLength =
                    view.getUint16(
                        localOffset + 26,
                        true
                    );


                const localExtraLength =
                    view.getUint16(
                        localOffset + 28,
                        true
                    );


                const dataStart =

                    localOffset
                    +
                    30
                    +
                    localNameLength
                    +
                    localExtraLength;


                const compressed =

                    bytes.slice(

                        dataStart,

                        dataStart +
                        compressedSize
                    );


                let data;


                /*
                 * 0 = 무압축
                 * 8 = Deflate
                 */

                if (
                    method ===
                    0
                ) {

                    data =
                        compressed.slice();

                } else if (
                    method ===
                    8
                ) {

                    data =
                        await inflateRaw(
                            compressed
                        );

                } else {

                    throw new Error(

                        `지원하지 않는 XLSX 압축 방식(${method}): ${name}`
                    );
                }


                if (
                    uncompressedSize !==
                    0xffffffff
                    &&
                    data.length !==
                    uncompressedSize
                ) {

                    throw new Error(

                        `XLSX 압축 해제 크기 오류: ${name}`
                    );
                }


                entries.set(

                    name,

                    {
                        name,
                        data,
                        modTime,
                        modDate
                    }
                );


                position +=

                    46
                    +
                    nameLength
                    +
                    extraLength
                    +
                    commentLength;
            }


            return new LocalZip(
                entries
            );
        }


        getBytes(
            name
        ) {

            return (
                this.entries
                    .get(
                        name
                    )
                    ?.data
                ??
                null
            );
        }


        getText(
            name
        ) {

            const data =
                this.getBytes(
                    name
                );


            return data == null
                ?
                null
                :
                new TextDecoder(
                    'utf-8'
                )
                .decode(
                    data
                );
        }


        setText(
            name,
            text
        ) {

            const previous =
                this.entries.get(
                    name
                );


            this.entries.set(

                name,

                {
                    name,

                    data:
                        new TextEncoder()
                            .encode(
                                text
                            ),

                    modTime:
                        previous
                            ?.modTime
                        || 0,

                    modDate:
                        previous
                            ?.modDate
                        || 0
                }
            );
        }


        /*
         * ZIP 재생성
         */

        generate() {

            const encoder =
                new TextEncoder();


            const records =
                [];


            let localTotal =
                0;


            let centralTotal =
                0;


            for (
                const entry
                of this.entries.values()
            ) {

                const nameBytes =
                    encoder.encode(
                        entry.name
                    );


                const data =
                    entry.data;


                const crc =
                    crc32(
                        data
                    )
                    >>> 0;


                const localLength =

                    30
                    +
                    nameBytes.length
                    +
                    data.length;


                const centralLength =

                    46
                    +
                    nameBytes.length;


                records.push({

                    entry,

                    nameBytes,

                    data,

                    crc,

                    localLength,

                    centralLength,

                    offset:
                        localTotal
                });


                localTotal +=
                    localLength;


                centralTotal +=
                    centralLength;
            }


            if (
                records.length >
                0xffff
            ) {

                throw new Error(
                    'ZIP 엔트리 수가 너무 많습니다.'
                );
            }


            const output =
                new Uint8Array(

                    localTotal
                    +
                    centralTotal
                    +
                    22
                );


            const view =
                new DataView(
                    output.buffer
                );


            let position =
                0;


            /*
             * Local File Header
             */

            for (
                const record
                of records
            ) {

                view.setUint32(
                    position,
                    0x04034b50,
                    true
                );


                view.setUint16(
                    position + 4,
                    20,
                    true
                );


                /*
                 * UTF-8 filename
                 */

                view.setUint16(
                    position + 6,
                    0x0800,
                    true
                );


                /*
                 * STORE = 무압축
                 */

                view.setUint16(
                    position + 8,
                    0,
                    true
                );


                view.setUint16(
                    position + 10,
                    record.entry
                        .modTime
                    || 0,
                    true
                );


                view.setUint16(
                    position + 12,
                    record.entry
                        .modDate
                    || 0,
                    true
                );


                view.setUint32(
                    position + 14,
                    record.crc,
                    true
                );


                view.setUint32(
                    position + 18,
                    record.data.length,
                    true
                );


                view.setUint32(
                    position + 22,
                    record.data.length,
                    true
                );


                view.setUint16(
                    position + 26,
                    record.nameBytes.length,
                    true
                );


                view.setUint16(
                    position + 28,
                    0,
                    true
                );


                output.set(

                    record.nameBytes,

                    position + 30
                );


                output.set(

                    record.data,

                    position +
                    30 +
                    record.nameBytes.length
                );


                position +=
                    record.localLength;
            }


            const centralStart =
                position;


            /*
             * Central Directory
             */

            for (
                const record
                of records
            ) {

                view.setUint32(
                    position,
                    0x02014b50,
                    true
                );


                view.setUint16(
                    position + 4,
                    20,
                    true
                );


                view.setUint16(
                    position + 6,
                    20,
                    true
                );


                view.setUint16(
                    position + 8,
                    0x0800,
                    true
                );


                view.setUint16(
                    position + 10,
                    0,
                    true
                );


                view.setUint16(
                    position + 12,
                    record.entry
                        .modTime
                    || 0,
                    true
                );


                view.setUint16(
                    position + 14,
                    record.entry
                        .modDate
                    || 0,
                    true
                );


                view.setUint32(
                    position + 16,
                    record.crc,
                    true
                );


                view.setUint32(
                    position + 20,
                    record.data.length,
                    true
                );


                view.setUint32(
                    position + 24,
                    record.data.length,
                    true
                );


                view.setUint16(
                    position + 28,
                    record.nameBytes.length,
                    true
                );


                view.setUint16(
                    position + 30,
                    0,
                    true
                );


                view.setUint16(
                    position + 32,
                    0,
                    true
                );


                view.setUint16(
                    position + 34,
                    0,
                    true
                );


                view.setUint16(
                    position + 36,
                    0,
                    true
                );


                view.setUint32(
                    position + 38,
                    0,
                    true
                );


                view.setUint32(
                    position + 42,
                    record.offset,
                    true
                );


                output.set(

                    record.nameBytes,

                    position + 46
                );


                position +=
                    record.centralLength;
            }


            const centralSize =

                position
                -
                centralStart;


            /*
             * End Of Central Directory
             */

            view.setUint32(
                position,
                0x06054b50,
                true
            );


            view.setUint16(
                position + 4,
                0,
                true
            );


            view.setUint16(
                position + 6,
                0,
                true
            );


            view.setUint16(
                position + 8,
                records.length,
                true
            );


            view.setUint16(
                position + 10,
                records.length,
                true
            );


            view.setUint32(
                position + 12,
                centralSize,
                true
            );


            view.setUint32(
                position + 16,
                centralStart,
                true
            );


            view.setUint16(
                position + 20,
                0,
                true
            );


            return output;
        }
    }


    function findEndOfCentralDirectory(
        bytes
    ) {

        if (
            bytes.length <
            22
        ) {

            throw new Error(
                'XLSX ZIP 파일이 손상되었습니다.'
            );
        }


        const view =
            new DataView(

                bytes.buffer,

                bytes.byteOffset,

                bytes.byteLength
            );


        const minimum =
            Math.max(
                0,
                bytes.length -
                65557
            );


        for (
            let i =
                bytes.length - 22;

            i >= minimum;

            i--
        ) {

            if (
                view.getUint32(
                    i,
                    true
                )
                ===
                0x06054b50
            ) {

                return i;
            }
        }


        throw new Error(
            'XLSX ZIP 종료 정보를 찾을 수 없습니다.'
        );
    }


    /*
     * Edge 자체 압축 해제 기능
     */

    async function inflateRaw(
        bytes
    ) {

        try {

            const stream =
                new Blob(
                    [bytes]
                )
                .stream()
                .pipeThrough(

                    new DecompressionStream(
                        'deflate-raw'
                    )
                );


            const buffer =
                await new Response(
                    stream
                )
                .arrayBuffer();


            return new Uint8Array(
                buffer
            );

        } catch (
            error
        ) {

            throw new Error(

                'Edge 로컬 ZIP 압축 해제 실패: '

                +

                (
                    error.message
                    ||
                    error
                )
            );
        }
    }


    /*
     * ZIP CRC32
     */

    let CRC32_TABLE =
        null;


    function crc32(
        bytes
    ) {

        if (
            !CRC32_TABLE
        ) {

            CRC32_TABLE =
                new Uint32Array(
                    256
                );


            for (
                let n = 0;
                n < 256;
                n++
            ) {

                let value =
                    n;


                for (
                    let k = 0;
                    k < 8;
                    k++
                ) {

                    value =

                        (
                            value &
                            1
                        )

                        ?

                        (
                            0xEDB88320
                            ^
                            (
                                value
                                >>>
                                1
                            )
                        )

                        :

                        (
                            value
                            >>>
                            1
                        );
                }


                CRC32_TABLE[n] =
                    value >>> 0;
            }
        }


        let crc =
            0xffffffff;


        for (
            const byte
            of bytes
        ) {

            crc =

                CRC32_TABLE[
                    (
                        crc ^
                        byte
                    )
                    &
                    0xff
                ]

                ^

                (
                    crc
                    >>>
                    8
                );
        }


        return (
            crc ^
            0xffffffff
        )
        >>> 0;
    }


    /*
     * XML
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
     * XLSX 내부 경로
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
                .split(
                    '/'
                );


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
     * 열 문자
     */

    function getColumnLetters(
        ref
    ) {

        const match =
            String(
                ref || ''
            )
            .match(
                /^([A-Z]+)\d+$/i
            );


        return match
            ?
            match[1]
                .toUpperCase()
            :
            '';
    }


    function columnToNumber(
        column
    ) {

        let result =
            0;


        for (
            const char
            of column
        ) {

            result =

                result *
                26

                +

                (
                    char
                        .charCodeAt(
                            0
                        )
                    -
                    64
                );
        }


        return result;
    }


    /*
     * 결과 파일명
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


        let base =
            match[1];


        const extension =
            match[2];


        if (
            !/_완성본$/i.test(
                base
            )
        ) {

            base +=
                '_완성본';
        }


        return (
            `${base}${extension}`
        );
    }


    function getMimeType(
        name
    ) {

        return /\.xlsm$/i.test(
            name
        )

            ?

            'application/vnd.ms-excel.sheet.macroEnabled.12'

            :

            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }


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
