import dayjs from "dayjs";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import CloudLoopIcon from "@/assets/icons/cloud-loop.svg?react";
import AnimatedNumber from "@/components/animated-number";
import { showBookGuide } from "@/components/book/util";
import BudgetCard from "@/components/budget/card";
import { HintTooltip } from "@/components/hint";
import { PaginationIndicator } from "@/components/indicator";
import Ledger from "@/components/ledger";
import Loading from "@/components/loading";
import { Promotion } from "@/components/promotion";
import WidgetPreview from "@/components/widget/preview";
import { useBudget } from "@/hooks/use-budget";
import { useSnap } from "@/hooks/use-snap";
import { useWidget } from "@/hooks/use-widget";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { denseDate } from "@/utils/time";

let ledgerAnimationShows = false;

export default function Page() {
    const t = useIntl();

    const { bills, loading, sync } = useLedgerStore();
    const currentBook = useBookStore(
        useShallow((state) => {
            const { currentBookId, books } = state;
            return books.find((b) => b.id === currentBookId);
        }),
    );
    const showAssets = usePreferenceStore(
        useShallow((state) => state.showAssetsInLedger),
    );
    const { id: userId } = useUserStore();
    const syncIconClassName =
        sync === "wait"
            ? "icon-[mdi--cloud-minus-outline]"
            : sync === "syncing"
              ? "icon-[line-md--cloud-alt-print-loop]"
              : sync === "success"
                ? "icon-[mdi--cloud-check-outline]"
                : "icon-[mdi--cloud-remove-outline] text-red-600";

    const [currentDate, setCurrentDate] = useState(dayjs());
    const ledgerRef = useRef<any>(null);

    const currentDateBills = useMemo(() => {
        const today = filterOrderedBillListByTimeRange(bills, [
            currentDate.startOf("day"),
            currentDate.endOf("day"),
        ]);
        return today;
    }, [bills, currentDate]);

    const currentDateAmount = useMemo(() => {
        return amountToNumber(
            currentDateBills.reduce((p, c) => {
                return p + c.amount * (c.type === "income" ? 1 : -1);
            }, 0),
        );
    }, [currentDateBills]);

    const { budgets: allBudgets } = useBudget();
    const budgets = allBudgets.filter((b) => {
        return b.joiners.includes(userId) && b.start < Date.now();
    });

    const { homeWidgets } = useWidget();

    const budgetContainer = useRef<HTMLDivElement>(null);
    const widgetContainer = useRef<HTMLDivElement>(null);
    const { count: budgetCount, index: curBudgetIndex } = useSnap(
        budgetContainer,
        0,
    );
    useSnap(widgetContainer, 0);

    const allLoaded = useRef(false);
    // 有预算时需要加载全部bills
    useLayoutEffect(() => {
        if (!allLoaded.current && budgets.length > 0) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [budgets.length]);

    // 滚动时需要加载全部bills
    const onDateClick = useCallback(
        (date: dayjs.Dayjs) => {
            setCurrentDate(date);
            const index = bills.findIndex((bill) => {
                const billDate = dayjs.unix(bill.time / 1000);
                return billDate.isSame(date, "day");
            });
            if (index >= 0) {
                ledgerRef.current?.scrollToIndex(index);
            }
        },
        [bills],
    );

    const onItemShow = useCallback((index: number) => {
        if (!allLoaded.current && index >= 120) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, []);

    const presence = useMemo(() => {
        if (ledgerAnimationShows) {
            return false;
        }
        return true;
    }, []);

    // safari capable
    useEffect(() => {
        ledgerAnimationShows = true;
    }, []);
    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden page-show">
            <div className="flex flex-wrap flex-col w-full gap-2">
                <div
                    data-today-overview
                    className="bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 text-background dark:from-white/12 dark:via-white/8 dark:to-white/4 dark:text-foreground relative h-22 w-full flex justify-end rounded-2xl sm:flex-1 p-4 shadow-lg shadow-stone-800/20 dark:shadow-black/30 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none" />
                    <span className="absolute top-3 left-4 text-sm font-medium tracking-wide opacity-80">
                        {denseDate(currentDate)}
                    </span>
                    <AnimatedNumber
                        value={currentDateAmount}
                        className="font-bold text-4xl tracking-tight"
                    />{" "}
                    {currentBook && (
                        <button
                            type="button"
                            className="absolute bottom-3 left-4 text-xs opacity-50 flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                                showBookGuide();
                            }}
                        >
                            <i className="icon-[mdi--book]"></i>
                            {currentBook.name}
                        </button>
                    )}
                </div>
                <Promotion />
                {homeWidgets.length > 0 && (
                    <div className="w-full flex flex-col gap-1">
                        <div
                            ref={widgetContainer}
                            className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                        >
                            {homeWidgets.map((widget) => (
                                <div
                                    key={widget.id}
                                    className="flex-shrink-0 snap-start w-full min-h-[100px] border border-border/60 rounded-xl overflow-hidden shadow-sm"
                                >
                                    <WidgetPreview widget={widget} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="w-full flex flex-col gap-1">
                    <div
                        ref={budgetContainer}
                        className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {budgets.map((budget) => {
                            return (
                                <BudgetCard
                                    className="flex-shrink-0 snap-start"
                                    key={budget.id}
                                    budget={budget}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="flex justify-between items-center pl-7 pr-5 py-1 h-8">
                <button
                    className="cursor-pointer flex items-center"
                    type="button"
                    onClick={() => {
                        if (loading) {
                            return;
                        }
                        useLedgerStore.getState().initCurrentBook();
                    }}
                >
                    <div className={cn("opacity-0", loading && "opacity-100")}>
                        <Loading className="[&_i]:size-[18px]" />
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    {budgetCount > 1 && (
                        <PaginationIndicator
                            count={budgetCount}
                            current={curBudgetIndex}
                        />
                    )}
                </div>
                <HintTooltip
                    persistKey={"cloudSyncHintShows"}
                    content={"等待云同步完成后，其他设备即可获取最新的账单数据"}
                >
                    <button
                        type="button"
                        className="cursor-pointer flex items-center"
                        onClick={() => {
                            StorageAPI.toSync();
                        }}
                    >
                        {sync === "syncing" ? (
                            <CloudLoopIcon width={18} height={18} />
                        ) : (
                            <i
                                className={cn(syncIconClassName, "size-[18px]")}
                            ></i>
                        )}
                    </button>
                </HintTooltip>
            </div>
            <div className="flex-1 translate-0 pb-[10px] overflow-hidden">
                <div className="w-full h-full">
                    {bills.length > 0 ? (
                        <Ledger
                            ref={ledgerRef}
                            bills={bills}
                            className={cn(bills.length > 0 && "relative")}
                            enableDivideAsOrdered
                            showTime
                            onItemShow={onItemShow}
                            onVisibleDateChange={setCurrentDate}
                            onDateClick={onDateClick}
                            presence={presence}
                            showAssets={showAssets}
                        />
                    ) : (
                        <div className="text-sm p-8 text-center text-muted-foreground/60">
                            {t("nothing-here-add-one-bill")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
