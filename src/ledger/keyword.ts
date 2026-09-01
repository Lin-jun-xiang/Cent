import type { BillFilter, BillKeyword } from "./type";

/** 空白分隔（含全角空格） */
const SPLITTER = /[\s　]+/;

/**
 * 将搜索文本切分为关键词：以空白分词，统一转为小写
 *
 * 例如 "C300 冷氣" -> ["c300", "冷氣"]
 */
export const tokenizeKeyword = (input: string) =>
    input.toLowerCase().split(SPLITTER).filter(Boolean);

type NamedCategory = { id: string; name: string; parent?: string };
type NamedTag = { id: string; name: string };

/**
 * 把搜索文本解析为可匹配的关键词结构
 *
 * 分类与标签的名称只在主线程（i18n 之后）才能拿到，worker 内无法访问，
 * 因此在这里先把「名称命中关键词」的分类、标签 id 解析出来再交给 worker 匹配
 */
export const resolveKeywords = (
    input: string | undefined,
    options: {
        categories?: NamedCategory[];
        tags?: NamedTag[];
    },
): BillKeyword[] | undefined => {
    const tokens = tokenizeKeyword(input ?? "");
    if (tokens.length === 0) {
        return undefined;
    }
    const { categories = [], tags = [] } = options;
    // 父分类命中时，其子分类也应视为命中，所以把父分类名一起作为可搜索文本
    const categoryTexts = categories.map((c) => ({
        id: c.id,
        text: [c.name, categories.find((p) => p.id === c.parent)?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
    }));
    const tagTexts = tags.map((v) => ({
        id: v.id,
        text: v.name.toLowerCase(),
    }));
    return tokens.map((text) => ({
        text,
        categories: categoryTexts
            .filter((c) => c.text.includes(text))
            .map((c) => c.id),
        tags: tagTexts.filter((v) => v.text.includes(text)).map((v) => v.id),
    }));
};

/**
 * 展开过滤器中的搜索文本（filter.comment），使其可以匹配备注、分类名与标签名
 *
 * 保存过滤器时只需保存原始文本，查询前再解析，分类改名后也不会失效
 */
export const resolveFilterKeywords = (
    filter: BillFilter,
    options: {
        categories?: NamedCategory[];
        tags?: NamedTag[];
    },
): BillFilter => {
    const keywords = resolveKeywords(filter.comment, options);
    if (!keywords) {
        return { ...filter, keywords: undefined };
    }
    return { ...filter, keywords };
};
