import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WordCloud from "wordcloud";
import useResize from "@/hooks/use-resize";
import { useTheme } from "@/hooks/use-theme";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { getCSSVariable } from "@/utils/color";
import { processText } from "@/utils/word";
import { MysteryLoading } from "../loading/mystery";

type WordCut = Awaited<ReturnType<typeof processText>>;

const DPR = window.devicePixelRatio || 2;
/**
 * 詞雲高度固定
 *
 * 早期把 canvas 高度綁在量測結果上，而 canvas 又以 h-full 撐開父層，
 * 造成「量測 → 改 canvas 尺寸 → 版面變動 → 重新量測」的迴圈，畫面會一直抖動
 */
const CLOUD_HEIGHT = 200;

const PALETTE_VARS = [
    "--category-color-1",
    "--category-color-2",
    "--category-color-3",
    "--category-color-4",
    "--category-color-5",
    "--category-color-6",
    "--category-color-7",
    "--category-color-8",
    "--category-color-other",
];

/**
 * 詞 → 顏色的固定對照表
 *
 * @param theme 淺／深色會讀到不同的一組系列色，所以要跟著主題重新建立
 */
function buildColorMap(data: WordCut, theme: string) {
    const palette = PALETTE_VARS.map((v) => getCSSVariable(v)).filter(Boolean);
    const map = new Map<string, string>();
    data.forEach(([word], index) => {
        map.set(
            String(word),
            palette[index % palette.length] || "currentColor",
        );
    });
    if (palette.length === 0) {
        console.warn(`word cloud palette is empty in ${theme} theme`);
    }
    return map;
}

function TextCloud({ data, className }: { data: WordCut; className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);
    const { theme } = useTheme();

    // 只觀測寬度：高度是固定值，才不會和版面互相牽動
    const onResize = useCallback((sizer: () => { width: number }) => {
        const next = Math.round(sizer().width);
        // 小於 2px 的變化不重繪，避免捲軸出現／消失時反覆觸發
        setWidth((prev) => (Math.abs(prev - next) < 2 ? prev : next));
    }, []);
    useResize(wrapper, onResize);

    /** 依詞頻排名指定固定顏色，重繪時不會換色 */
    const colorOf = useMemo(
        () => buildColorMap(data, theme),
        // theme 變化時要重新讀取 CSS 變數（深淺色是兩組系列色）
        [data, theme],
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width === 0 || data.length === 0) {
            return;
        }
        canvas.width = Math.round(width * DPR);
        canvas.height = Math.round(CLOUD_HEIGHT * DPR);
        const max = data[0][1] || 1;
        // 停掉上一輪還沒畫完的動畫，否則兩次繪製會疊在一起
        WordCloud.stop();
        WordCloud(canvas, {
            list: data,
            gridSize: Math.max(8, Math.round(width / 40)),
            weightFactor: (size) =>
                Math.max((size / max) * 40, 11) * (width / 320) * DPR,
            fontFamily: "sans-serif",
            fontWeight: "600",
            color: (word) => colorOf.get(String(word)) ?? "currentColor",
            backgroundColor: "transparent",
            // 中文旋轉後不好讀；固定不旋轉、不打亂順序，讓每次重繪結果一致
            rotateRatio: 0,
            shuffle: false,
            drawOutOfBound: false,
        });
        return () => {
            WordCloud.stop();
        };
    }, [data, width, colorOf]);

    return (
        <div
            ref={setWrapper}
            className={cn("relative w-full", className)}
            style={{ height: CLOUD_HEIGHT }}
        >
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    );
}

export function AnalysisCloud({ bills }: { bills?: { comment?: string }[] }) {
    const t = useIntl();
    const [wordCut, setWordCut] = useState<WordCut>();
    useEffect(() => {
        const texts: string[] = [];
        bills?.forEach(({ comment }) => {
            if (comment !== undefined) {
                texts.push(comment);
            }
        }, []);
        processText(texts).then(setWordCut);
    }, [bills]);
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
