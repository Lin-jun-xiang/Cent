export const getCSSVariable = (variable: string) => {
    if (typeof document === "undefined") return "";
    const rootStyle = getComputedStyle(document.body);
    return rootStyle.getPropertyValue(variable).trim();
};

/**
 * 建立「名稱 → 固定顏色」的分配器
 *
 * 顏色跟著名稱（分類 / 協作者），不跟著排名，
 * 所以篩掉其中一項時，其餘項目的顏色不會被重新洗牌
 *
 * @param preset 固定順序的槽位色
 * @param overflow 槽位用完後的顏色；預設用中性灰把後續項目收成「其他」，
 *                 而不是自動生成新色相（生成色無法保證明度與色弱可辨性）
 */
export const createColorSet = (preset: string[], overflow?: string) => {
    const assignedMap = new Map<string, string>();

    // 记录当前分配到第几个“新色”了
    let colorIndex = 0;

    const getColor = (name: string): string => {
        const existing = assignedMap.get(name);
        if (existing !== undefined) return existing;

        const finalColor =
            colorIndex < preset.length
                ? preset[colorIndex]
                : (overflow ?? preset[preset.length - 1] ?? "");

        colorIndex++;
        assignedMap.set(name, finalColor);
        return finalColor;
    };

    return getColor;
};

/** 与 `src/index.css` 中系列色一致，仅在无 DOM（如测试）时作回退 */
const CHART_SERIES_FALLBACK = [
    "#2b9c8c",
    "#dd5347",
    "#3b7ad0",
    "#c07f0d",
    "#9057d6",
    "#4aa338",
    "#c74580",
    "#0f8fbf",
] as const;

/** 槽位用完後的中性色，對應 `--category-color-other` */
const OVERFLOW_FALLBACK = "#8b989c";

const CATEGORY_COLOR_VARS = [
    "--category-color-1",
    "--category-color-2",
    "--category-color-3",
    "--category-color-4",
    "--category-color-5",
    "--category-color-6",
    "--category-color-7",
    "--category-color-8",
] as const;

const COLLABORATOR_COLOR_VARS = [
    "--collaborator-color-1",
    "--collaborator-color-2",
    "--collaborator-color-3",
    "--collaborator-color-4",
    "--collaborator-color-5",
    "--collaborator-color-6",
    "--collaborator-color-7",
    "--collaborator-color-8",
] as const;

const chartPresetFromVarNames = (names: readonly string[]): string[] =>
    names.map((name, i) => {
        const v = getCSSVariable(name);
        if (v) return v;
        const fb = CHART_SERIES_FALLBACK[i];
        return fb !== undefined ? fb : "";
    });

export const categoryColors = createColorSet(
    chartPresetFromVarNames(CATEGORY_COLOR_VARS),
    getCSSVariable("--category-color-other") || OVERFLOW_FALLBACK,
);

export const collaboratorColors = createColorSet(
    chartPresetFromVarNames(COLLABORATOR_COLOR_VARS),
    getCSSVariable("--collaborator-color-other") || OVERFLOW_FALLBACK,
);
