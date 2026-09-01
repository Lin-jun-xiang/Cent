import type { AnalysisResult } from "@/api/storage/analysis";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { toFixed } from "@/utils/number";
import Money from "../money";
import { CardHead } from "./chart-part";
import type { FocusType } from "./focus-type";

/**
 * 期間概況：圖之前先給結論
 *
 * 主數字是目前聚焦的收支別，並列出日均與環比；
 * 環比在上一期沒有資料時顯示「資料不足」，不用 0 硬算成 100%
 */
export function PeriodSummary({
    focusType,
    totals,
    analysis,
    count,
    highest,
}: {
    focusType: FocusType;
    totals: { income: number; expense: number; balance: number };
    analysis?: AnalysisResult;
    count: number;
    highest?: number;
}) {
    const t = useIntl();

    const focusLabel =
        focusType === "income"
            ? t("income")
            : focusType === "expense"
              ? t("expense")
              : t("Balance");
    const focusTotal = totals[focusType];
    const focusColor =
        focusType === "income"
            ? "var(--color-income)"
            : focusType === "expense"
              ? "var(--color-expense)"
              : "var(--primary)";
    const focusTextClass =
        focusType === "income"
            ? "text-semantic-income-strong"
            : focusType === "expense"
              ? "text-semantic-expense-strong"
              : "text-foreground";

    const previousTotal = analysis?.previous.total;
    const currentTotal = analysis?.current.total;
    const change =
        previousTotal === undefined ||
        currentTotal === undefined ||
        previousTotal === 0
            ? undefined
            : (currentTotal - previousTotal) / previousTotal;

    /** 支出變多是壞事、收入變多是好事，用色跟著語意走 */
    const changeClass =
        change === undefined || Math.abs(change) < 0.005
            ? "text-muted-foreground"
            : change > 0 === (focusType === "expense")
              ? "text-semantic-expense-strong"
              : "text-semantic-income-strong";

    return (
        <div className="flex-shrink-0 w-full surface overflow-hidden">
            <CardHead title={t("period-summary")} />
            <div className="px-3 pb-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: focusColor }}
                    />
                    {focusLabel}
                </div>
                <div
                    className={cn(
                        "text-[26px] font-semibold tnum leading-tight",
                        focusTextClass,
                    )}
                >
                    <Money value={focusTotal} largeAmountThreshold={100000} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {analysis && (
                        <span>
                            {t("day-avg")}{" "}
                            <span className="tnum text-foreground">
                                <Money
                                    value={amountToNumber(
                                        analysis.current.dayAvg,
                                    )}
                                />
                            </span>
                        </span>
                    )}
                    <span className={changeClass}>
                        {change === undefined ? (
                            `${t("vs-previous")} ${t("insufficient-data")}`
                        ) : (
                            <>
                                {change > 0 ? "↑" : change < 0 ? "↓" : "→"}{" "}
                                <span className="tnum">
                                    {toFixed(Math.abs(change) * 100, 1)}%
                                </span>{" "}
                                {t("vs-previous")}
                            </>
                        )}
                    </span>
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
                <span>
                    {t("expense")}{" "}
                    <b className="tnum font-semibold text-foreground">
                        <Money
                            value={totals.expense}
                            largeAmountThreshold={100000}
                        />
                    </b>
                </span>
                <span>
                    {t("income")}{" "}
                    <b className="tnum font-semibold text-foreground">
                        <Money
                            value={totals.income}
                            largeAmountThreshold={100000}
                        />
                    </b>
                </span>
                {highest !== undefined && highest > 0 && (
                    <span>
                        {t("highest-single")}{" "}
                        <b className="tnum font-semibold text-foreground">
                            <Money
                                value={highest}
                                largeAmountThreshold={100000}
                            />
                        </b>
                    </span>
                )}
                <span>
                    <b className="tnum font-semibold text-foreground">
                        {count}
                    </b>{" "}
                    {t("item")}
                </span>
            </div>
        </div>
    );
}
