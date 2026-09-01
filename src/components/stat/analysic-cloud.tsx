import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { processText } from "@/utils/word";
import { MysteryLoading } from "../loading/mystery";

type WordCut = Awaited<ReturnType<typeof processText>>;

/**
 * 詞雲最多顯示幾個詞
 *
 * 之前取 150 個並交給 canvas 版詞雲做碰撞排版，光是放不下的詞就要把所有位置試完，
 * 在手機上會把主執行緒佔住；實際上超過 40 個詞已經看不出資訊量差異
 */
const MAX_WORDS = 40;

/** 字級階梯：由詞頻決定，用 sqrt 讓面積感受接近比例 */
const MIN_SIZE = 13;
const MAX_SIZE = 30;

/** 依排名取色，色相順序與圖表一致 */
const PALETTE = [
    "var(--category-color-1)",
    "var(--category-color-2)",
    "var(--category-color-3)",
    "var(--category-color-4)",
    "var(--category-color-5)",
    "var(--category-color-6)",
    "var(--category-color-7)",
    "var(--category-color-8)",
];

/**
 * 把「由大到小」的清單重新排列成大小交錯
 *
 * 直接照詞頻排會讓大字全部擠在左上角；從頭尾交替取用可以讓視覺重量分散開來
 */
function interleave<T>(list: T[]) {
    const result: T[] = [];
    let head = 0;
    let tail = list.length - 1;
    while (head <= tail) {
        result.push(list[head]);
        head += 1;
        if (head <= tail) {
            result.push(list[tail]);
            tail -= 1;
        }
    }
    return result;
}

/**
 * 排版式詞雲
 *
 * 不用 canvas：沒有清空重繪造成的閃爍、沒有碰撞搜尋的運算量，
 * 而且每個詞都是真正的文字（可點擊、可讀屏、可選取），點一下就用該詞去搜尋
 */
function TextCloud({ data }: { data: WordCut }) {
    const navigate = useNavigate();
    const t = useIntl();

    const words = useMemo(() => {
        const top = data.slice(0, MAX_WORDS);
        const max = top[0]?.[1] || 1;
        const min = top[top.length - 1]?.[1] || 1;
        const span = Math.max(1, max - min);
        const sized = top.map(([word, count], index) => ({
            word: String(word),
            count,
            // 以 sqrt 縮放，字級不會被單一極高頻詞拉到極端
            size:
                MIN_SIZE +
                (MAX_SIZE - MIN_SIZE) * Math.sqrt((count - min) / span),
            color: PALETTE[index % PALETTE.length],
            rank: index,
        }));
        return interleave(sized);
    }, [data]);

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 py-2">
            {words.map((item) => (
                <button
                    key={item.word}
                    type="button"
                    title={t("total-records", { n: item.count })}
                    className={cn(
                        "leading-tight rounded px-0.5 cursor-pointer transition-opacity hover:opacity-70",
                        // 高頻詞加粗，讓層次不只靠字級
                        item.rank < 6 ? "font-bold" : "font-medium",
                    )}
                    style={{
                        fontSize: `${item.size.toFixed(1)}px`,
                        color: item.color,
                    }}
                    onClick={() => {
                        navigate("/search", {
                            state: { filter: { comment: item.word } },
                        });
                    }}
                >
                    {item.word}
                </button>
            ))}
        </div>
    );
}

export function AnalysisCloud({ bills }: { bills?: { comment?: string }[] }) {
    const t = useIntl();
    const [wordCut, setWordCut] = useState<WordCut>();

    /**
     * 以備註內容本身作為依賴
     *
     * bills 陣列的參照每次重算都會變，但內容常常一模一樣；
     * 用文字內容比對可以避免重複跑 jieba 分詞（那是最貴的一步）
     */
    const text = useMemo(
        () =>
            (bills ?? [])
                .map(({ comment }) => comment)
                .filter((v): v is string => Boolean(v))
                .join("\n"),
        [bills],
    );

    useEffect(() => {
        if (text.length === 0) {
            setWordCut([]);
            return;
        }
        let cancelled = false;
        processText(text, MAX_WORDS).then((list) => {
            if (!cancelled) {
                setWordCut(list);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [text]);

    return (
        <div className="surface p-3 w-full flex flex-col relative">
            <h2 className="section-title text-center py-1">
                {t("comment-cloud")}
            </h2>
            {wordCut === undefined ? (
                <MysteryLoading className="w-full h-[150px] rounded-md">
                    <div className="text-[white] text-sm">{t("loading")}</div>
                </MysteryLoading>
            ) : wordCut.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">
                    {t("no-comment-cloud")}
                </div>
            ) : (
                <TextCloud data={wordCut} />
            )}
        </div>
    );
}
