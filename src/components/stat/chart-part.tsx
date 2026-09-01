import type { ECElementEvent } from "echarts/core";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCurrency } from "@/hooks/use-currency";
import type { BillFilter } from "@/ledger/extra-type";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import {
    overallTrendOption,
    type PieChartDataItem,
    processBillDataForCharts,
    structureOption,
    userTrendOption,
} from "@/utils/charts";
import { categoryColors, collaboratorColors } from "@/utils/color";
import { toFixed } from "@/utils/number";
import CategoryIcon from "../category/icon";
import Chart, { type ChartInstance } from "../chart";
import Money from "../money";
import { Button } from "../ui/button";
import CalendarDetail from "./calendar-detail";
import type { ViewType } from "./date-slice";
import type { FocusType } from "./focus-type";

/** 卡片抬頭：小標在左、切換器在右，不再用絕對定位的圖示壓在圖上 */
export function CardHead({
    title,
    children,
}: {
    title: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <div className="section-title truncate">{title}</div>
            {children}
        </div>
    );
}

/** 分段切換器 */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: ReactNode }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="inline-flex flex-shrink-0 gap-0.5 p-0.5 rounded-full border border-border bg-muted/60">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] leading-none cursor-pointer transition-colors",
                        value === option.value
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function useChartPart({
    viewType,
    seeDetails,
    focusType,
    filtered,
    dimension,
    displayCurrency,
}: {
    viewType: ViewType;
    seeDetails: (append?: Partial<BillFilter>) => void;
    focusType: FocusType;
    filtered: Bill[];
    dimension: "category" | "user";
    displayCurrency?: string;
}) {
    const t = useIntl();

    const { convert, baseCurrency } = useCurrency();
    const rateToDisplayCurrency = useMemo(() => {
        return displayCurrency
            ? convert(1, displayCurrency, baseCurrency.id).predict
            : 1;
    }, [displayCurrency, baseCurrency.id, convert]);

    const trendChart = useRef<ChartInstance>(undefined);
    // 趨勢卡的檢視方式
    const [trendView, setTrendView] = useState<"chart" | "calendar">("chart");
    // 結構卡的檢視方式：條狀為預設，圓餅為可切換選項
    const [structureView, setStructureView] = useState<"bars" | "pie">("bars");
    const asCalendar = trendView === "calendar";

    const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
    const { categories } = useCategory();
    const creators = useCreators();

    const dataSources = useMemo(
        () =>
            processBillDataForCharts(
                {
                    bills: filtered,
                    getCategory: (id) => {
                        const cate = categories.find((c) => c.id === id);
                        if (!cate?.parent) {
                            return cate
                                ? { ...cate, parent: { ...cate } }
                                : { id, name: id, parent: { id, name: id } };
                        }
                        const parent = categories.find(
                            (c) => c.id === cate.parent,
                        )!;
                        return { ...cate, parent };
                    },
                    getUserInfo: (id) => {
                        return {
                            id,
                            name:
                                creators.find((u) => `${u.id}` === id)?.name ??
                                `${id}`,
                        };
                    },
                    gap: viewType === "yearly" ? "month" : undefined,
                    displayCurrency,
                    rateToDisplayCurrency,
                },
                t,
            ),
        [
            filtered,
            viewType,
            categories,
            creators,
            displayCurrency,
            rateToDisplayCurrency,
            t,
        ],
    );

    /** 結構資料：依目前的維度與收支別挑出對應的一組 */
    const structureData = useMemo<PieChartDataItem[]>(() => {
        if (dimension === "category") {
            return focusType === "income"
                ? dataSources.incomeStructure
                : dataSources.expenseStructure;
        }
        return focusType === "income"
            ? dataSources.userIncomeStructure
            : focusType === "expense"
              ? dataSources.userExpenseStructure
              : dataSources.userBalanceStructure;
    }, [
        dimension,
        focusType,
        dataSources.incomeStructure,
        dataSources.expenseStructure,
        dataSources.userIncomeStructure,
        dataSources.userExpenseStructure,
        dataSources.userBalanceStructure,
    ]);

    /** 標題改由卡片抬頭顯示，圖內不再重複一次 */
    const titles = useMemo(() => {
        const trend =
            dimension === "category"
                ? t("overall-trend")
                : focusType === "income"
                  ? t("users-income-trend")
                  : focusType === "expense"
                    ? t("users-expense-trend")
                    : t("users-balance-trend");
        const structure =
            focusType === "income"
                ? t("income-structure")
                : t("expense-structure");
        return { trend, structure };
    }, [dimension, focusType, t]);

    const charts = useMemo(() => {
        if (dimension === "category") {
            const incomeName = dataSources.overallTrend.source?.[0]?.[1];
            const expenseName = dataSources.overallTrend.source?.[0]?.[2];
            const balanceName = dataSources.overallTrend.source?.[0]?.[3];

            return [
                overallTrendOption(dataSources.overallTrend, {
                    legend: {
                        selected: {
                            [incomeName]: focusType === "income",
                            [expenseName]: focusType === "expense", // 默认选中（显示）
                            [balanceName]: focusType === "balance",
                        },
                    },
                }),
                structureOption(structureData),
            ];
        }
        return [
            focusType === "expense"
                ? userTrendOption(dataSources.userExpenseTrend)
                : focusType === "income"
                  ? userTrendOption(dataSources.userIncomeTrend)
                  : userTrendOption(dataSources.userBalanceTrend),
            structureOption(structureData),
        ];
    }, [
        dimension,
        focusType,
        structureData,
        dataSources.overallTrend,
        dataSources.userBalanceTrend,
        dataSources.userExpenseTrend,
        dataSources.userIncomeTrend,
    ]);

    const onStructureChartClick = useCallback((params: ECElementEvent) => {
        if (params.componentType === "series" && params.seriesType === "pie") {
            setSelectedCategoryId((params.data as PieChartDataItem).id);
        }
    }, []);
    const selectedCategory = useMemo(() => {
        return categories.find((c) => c.id === selectedCategoryId);
    }, [categories, selectedCategoryId]);

    const selectedCategoryChart = useMemo(() => {
        if (dimension !== "category") {
            return undefined;
        }
        if (!selectedCategory) {
            return undefined;
        }
        const data = dataSources.subCategoryStructure[selectedCategory.id];
        if (!data) {
            return undefined;
        }
        return structureOption(data);
    }, [dimension, dataSources.subCategoryStructure, selectedCategory]);

    const calendarRange = useMemo(
        () => [filtered[0]?.time, filtered[filtered.length - 1]?.time],
        [
            filtered[0]?.time,
            filtered[filtered.length - 1]?.time,
            filtered.length,
            filtered,
        ],
    );

    const seeFocusedLedgers = (
        <div className="flex justify-end px-1 pb-1">
            <Button
                variant="ghost"
                size={"sm"}
                className="text-xs text-muted-foreground"
                onClick={() => {
                    seeDetails({
                        type: focusType === "balance" ? undefined : focusType,
                    });
                }}
            >
                {focusType === "expense"
                    ? t("see-expense-ledgers")
                    : t("see-income-ledgers")}
                <i className="icon-[mdi--arrow-up-right]"></i>
            </Button>
        </div>
    );

    const Part = (
        <>
            <div className="flex-shrink-0 w-full surface overflow-hidden">
                <CardHead title={titles.trend}>
                    {viewType !== "custom" && (
                        <Segmented
                            value={trendView}
                            onChange={setTrendView}
                            options={[
                                { value: "chart", label: t("as-chart") },
                                { value: "calendar", label: t("as-calendar") },
                            ]}
                        />
                    )}
                </CardHead>
                {asCalendar && viewType !== "custom" ? (
                    <div className="w-full pb-2">
                        <CalendarDetail
                            viewType={viewType}
                            focusType={focusType}
                            dataset={charts[0].dataset as any}
                            dimension={dimension}
                            range={calendarRange}
                        />
                    </div>
                ) : (
                    <Chart
                        ref={trendChart}
                        key={dimension}
                        option={charts[0]}
                        className="w-full h-[260px]"
                    />
                )}
            </div>
            {focusType !== "balance" && (
                <div className="flex-shrink-0 w-full surface overflow-hidden">
                    <CardHead title={titles.structure}>
                        <Segmented
                            value={structureView}
                            onChange={setStructureView}
                            options={[
                                { value: "bars", label: t("as-bars") },
                                { value: "pie", label: t("as-pie") },
                            ]}
                        />
                    </CardHead>
                    {structureView === "bars" ? (
                        <div className="w-full px-3 pb-2">
                            <CategoryBars
                                data={structureData}
                                focusType={focusType}
                                subData={
                                    dimension === "category"
                                        ? dataSources.subCategoryStructure
                                        : undefined
                                }
                                dimension={dimension}
                                onSeeDetails={(item) => {
                                    // 依使用者的維度下，item.id 是記帳者而不是分類
                                    if (dimension === "user") {
                                        seeDetails({ creators: [item.id] });
                                        return;
                                    }
                                    seeDetails({
                                        categories: categories
                                            .filter(
                                                (c) =>
                                                    c.id === item.id ||
                                                    c.parent === item.id,
                                            )
                                            .map((c) => c.id),
                                    });
                                }}
                                onSeeSubDetails={(item) => {
                                    seeDetails({ categories: [item.id] });
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-full">
                            <Chart
                                key={dimension}
                                option={charts[1]}
                                className="w-full h-[280px]"
                                onClick={onStructureChartClick}
                            />
                        </div>
                    )}
                    {seeFocusedLedgers}
                </div>
            )}
            {structureView === "pie" && selectedCategoryChart && (
                <div className="flex-shrink-0 w-full surface overflow-hidden">
                    <CardHead title={selectedCategory?.name} />
                    <div className="w-full h-[260px]">
                        <Chart
                            option={selectedCategoryChart}
                            className="w-full h-full"
                        />
                    </div>
                    <div className="flex justify-end px-1 pb-1">
                        <Button
                            variant="ghost"
                            size={"sm"}
                            className="text-xs text-muted-foreground"
                            onClick={() => {
                                if (selectedCategory) {
                                    seeDetails({
                                        categories: [selectedCategory?.id],
                                    });
                                }
                            }}
                        >
                            {t("see-category-ledgers")}
                            <i className="icon-[mdi--arrow-up-right]"></i>
                        </Button>
                    </div>
                </div>
            )}
        </>
    );

    return {
        Part,
        dataSources,
        setSelectedCategoryId,
    };
}

/**
 * 條狀結構圖（預設檢視）
 *
 * 相較圓餅：長度可直接互相比較、名稱與金額直接標在旁邊、窄螢幕不會有引線打結的問題。
 * 點一列展開子分類，點金額進到明細。
 */
function CategoryBars({
    data,
    focusType,
    subData,
    dimension,
    onSeeDetails,
    onSeeSubDetails,
}: {
    data: PieChartDataItem[];
    focusType: FocusType;
    subData?: Record<string, PieChartDataItem[]>;
    dimension: "category" | "user";
    onSeeDetails?: (item: PieChartDataItem) => void;
    onSeeSubDetails?: (item: PieChartDataItem) => void;
}) {
    const t = useIntl();
    const { categories } = useCategory();
    const [expandedId, setExpandedId] = useState<string>();

    const sorted = useMemo(
        () => [...data].sort((a, b) => b.value - a.value),
        [data],
    );
    const total = sorted.reduce((p, c) => p + c.value, 0);
    const max = sorted.reduce((p, c) => Math.max(p, c.value), 0) || 1;
    const colorOf =
        dimension === "category" ? categoryColors : collaboratorColors;
    const sign =
        focusType === "expense" ? "-" : focusType === "income" ? "+" : "";

    if (sorted.length === 0) {
        return (
            <div className="py-8 text-center text-xs text-muted-foreground">
                {t("no-data")}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 pt-1">
            {sorted.map((item) => {
                const category = categories.find((c) => c.id === item.id);
                const color = colorOf(item.id);
                const percent = total === 0 ? 0 : (item.value / total) * 100;
                const subs = subData?.[item.id];
                // 只有一個子分類時展開沒有意義（就是它自己）
                const expandable = (subs?.length ?? 0) > 1;
                const expanded = expandedId === item.id;
                const subMax =
                    subs?.reduce((p, c) => Math.max(p, c.value), 0) || 1;
                return (
                    <div key={item.id} className="flex flex-col gap-1">
                        {/* biome-ignore lint/a11y/useKeyWithClickEvents: 內含按鈕，整列以 button 呈現 */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-expanded={
                                        expandable ? expanded : undefined
                                    }
                                    className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                                    onClick={() => {
                                        if (!expandable) {
                                            return;
                                        }
                                        setExpandedId(
                                            expanded ? undefined : item.id,
                                        );
                                    }}
                                >
                                    {category ? (
                                        <span
                                            className="size-6 flex-shrink-0 rounded-full flex items-center justify-center"
                                            style={{
                                                backgroundColor: `${color}1f`,
                                            }}
                                        >
                                            <CategoryIcon
                                                icon={category.icon}
                                                color={color}
                                            />
                                        </span>
                                    ) : (
                                        <span
                                            className="size-2 flex-shrink-0 rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                    )}
                                    <span className="text-sm truncate">
                                        {category?.name ?? item.name}
                                    </span>
                                    {expandable && (
                                        <i
                                            className={cn(
                                                "icon-[mdi--chevron-down] size-4 flex-shrink-0 text-muted-foreground transition-transform",
                                                expanded && "rotate-180",
                                            )}
                                        />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-xs tnum cursor-pointer hover:text-foreground text-muted-foreground"
                                    onClick={() => onSeeDetails?.(item)}
                                >
                                    <span className="font-semibold text-foreground">
                                        {sign}
                                        <Money value={item.value} />
                                    </span>
                                    <span>{toFixed(percent, 1)}%</span>
                                    <i className="icon-[mdi--arrow-up-right] size-3.5" />
                                </button>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-[width] duration-300"
                                    style={{
                                        width: `${(item.value / max) * 100}%`,
                                        backgroundColor: color,
                                    }}
                                />
                            </div>
                        </div>
                        {expandable && expanded && (
                            <div className="flex flex-col gap-1.5 ml-4 pl-3 border-l-2 border-border py-1">
                                {[...(subs ?? [])]
                                    .sort((a, b) => b.value - a.value)
                                    .map((sub) => (
                                        <button
                                            key={sub.id}
                                            type="button"
                                            className="flex flex-col gap-1 text-left cursor-pointer"
                                            onClick={() =>
                                                onSeeSubDetails?.(sub)
                                            }
                                        >
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="truncate text-muted-foreground">
                                                    {categories.find(
                                                        (c) => c.id === sub.id,
                                                    )?.name ?? sub.name}
                                                </span>
                                                <span className="tnum">
                                                    <Money value={sub.value} />
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full opacity-60"
                                                    style={{
                                                        width: `${(sub.value / subMax) * 100}%`,
                                                        backgroundColor: color,
                                                    }}
                                                />
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
