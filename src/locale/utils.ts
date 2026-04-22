export type LocaleName = "zh-TW" | "zh" | "en";

export const locales = [
    {
        name: "zh-TW",
        fetcher: () => import("./lang/zh-TW.json"),
        matcher: (_l: string) =>
            _l.includes("zh-TW") ||
            _l.includes("zh-HK") ||
            _l.includes("zh-Hant"),
        label: "中文-繁體",
    },
    {
        name: "zh",
        fetcher: () => import("./lang/zh.json"),
        matcher: (_l: string) => _l.includes("zh-CN") || _l.includes("zh-SG"),
        label: "中文-简体",
    },
    {
        name: "en",
        fetcher: () => import("./lang/en.json"),
        matcher: (_l: string) => true,
        label: "English",
    },
] as const;

export const getBrowserLang = (): LocaleName => {
    const browserLang: string =
        navigator.language || (navigator as any).browserLanguage;
    const locale = locales.find((l) => l.matcher(browserLang));
    return (locale?.name ?? "zh-TW") as LocaleName;
};
