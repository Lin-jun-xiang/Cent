import dayjs from "dayjs";
import { orderBy, sortBy } from "lodash-es";
import { Collapsible } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import BillFilterForm from "@/components/bill-filter";
import Clearable from "@/components/clearable";
import { HintTooltip } from "@/components/hint";
import Ledger from "@/components/ledger";
import {
    type BatchEditOptions,
    BatchEditProvider,
    showBatchEdit,
} from "@/components/ledger/batch-edit";
import modal from "@/components/modal";
import Money from "@/components/money";
import Tag from "@/components/tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import useCategory from "@/hooks/use-category";
import { useCurrency } from "@/hooks/use-currency";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import { useTag } from "@/hooks/use-tag";
import { amountToNumber } from "@/ledger/bill";
import { resolveFilterKeywords } from "@/ledger/keyword";
import type { Bill, BillFilter, BillType } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { cn } from "@/utils";

const SORTS = [
    // 最近的在最上面
    {
        by: "time",
        order: "desc",
        icon: "icon-[mdi--sort-clock-ascending-outline]",
        label: "newest",
    },
    // 最早的在最上面
    {
        by: "time",
        order: "asc",
        icon: "icon-[mdi--sort-clock-descending-outline]",
        label: "oldest",
    },
    // 数额最大的在最上面
    {
        by: "amount",
        order: "desc",
        icon: "icon-[mdi--sort-descending]",
        label: "highest-amount",
    },
    // 数额最小的在最上面
    {
        by: "amount",
        order: "asc",
        icon: "icon-[mdi--sort-ascending]",
        label: "lowest-amount",
    },
] as const;

/** 快捷时间筛选，range 返回 [start, end] 毫秒时间戳 */
const TIME_PRESETS = [
    {
        label: "unlimited",
        range: () => [undefined, undefined] as const,
    },
    {
        label: "last-7-days",
        range: () =>
            [
                dayjs().subtract(6, "day").startOf("day").valueOf(),
                dayjs().endOf("day").valueOf(),
            ] as const,
    },
    {
        label: "last-30-days",
        range: () =>
            [
                dayjs().subtract(29, "day").startOf("day").valueOf(),
                dayjs().endOf("day").valueOf(),
            ] as const,
    },
    {
        label: "this-month",
        range: () =>
            [
                dayjs().startOf("month").valueOf(),
                dayjs().endOf("month").valueOf(),
            ] as const,
    },
    {
        label: "last-month",
        range: () =>
            [
                dayjs().subtract(1, "month").startOf("month").valueOf(),
                dayjs().subtract(1, "month").endOf("month").valueOf(),
            ] as const,
    },
    {
        label: "this-year",
        range: () =>
            [
                dayjs().startOf("year").valueOf(),
                dayjs().endOf("year").valueOf(),
            ] as const,
    },
] as const;

export default function Page() {
    const t = useIntl();

    const { baseCurrency } = useCurrency();
    const { categories } = useCategory();
    const { state } = useLocation();
    const [form, setForm] = useState<BillFilter>(() => {
        const filter = state?.filter as BillFilter;
        if (filter) {
            return {
                baseCurrency: baseCurrency.id,
                ...filter,
                // 如果传入的参数只有父级分类，则需要同时选择子级分类
                categories: categories
                    .filter((c) =>
                        filter.categories?.some(
                            (v) => v === c.id || v === c.parent,
                        ),
                    )
                    .map((c) => c.id),
            };
        }
        return {};
    });
    const [filterOpen, setFilterOpen] = useState(false);

    const toReset = useCallback(() => {
        setForm({});
    }, []);

    const showAssets = usePreferenceStore(
        useShallow((state) => state.showAssetsInLedger),
    );

    const { tags: allTags } = useTag();

    const [list, setList] = useState<Bill[]>([]);
    const [searched, setSearched] = useState(false);
    const toSearch = useCallback(async () => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        setEnableSelect(false);
        setSelectedIds([]);
        // 结果筛选只对上一次的搜索结果有意义，重新搜索时重置
        setPickedCategories([]);
        setPickedTags([]);
        setPickedType(undefined);
        // 搜索文本需要在主线程解析（worker 内拿不到 i18n 后的分类名）
        const result = await StorageDeferredAPI.filter(
            book,
            resolveFilterKeywords(form, {
                categories,
                tags: allTags,
            }),
        );
        setList(result);
    }, [form, categories, allTags]);

    /** 当前生效的快捷时间筛选 */
    const activePreset = useMemo(() => {
        if (form.recent !== undefined) {
            return undefined;
        }
        return TIME_PRESETS.find(({ range }) => {
            const [start, end] = range();
            return form.start === start && form.end === end;
        })?.label;
    }, [form.start, form.end, form.recent]);

    /** 点击快捷时间后立即重新查询（form 更新后由下方 effect 触发） */
    const autoSearch = useRef(false);
    const applyPreset = useCallback((preset: (typeof TIME_PRESETS)[number]) => {
        const [start, end] = preset.range();
        autoSearch.current = true;
        setForm((prev) => ({ ...prev, start, end, recent: undefined }));
    }, []);

    useEffect(() => {
        if (!autoSearch.current) {
            return;
        }
        autoSearch.current = false;
        toSearch();
    }, [toSearch]);

    const navigate = useNavigate();
    const { addFilter } = useCustomFilters();
    const toSaveFilter = useCallback(async () => {
        const name = (await modal.prompt({
            title: t("please-enter-a-name-for-current-filter"),
            input: { type: "text" },
        })) as string;
        if (!name) {
            return;
        }
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const id = await addFilter(name, { filter: form });
        navigate(`/stat/${id}`);
    }, [addFilter, form, navigate, t]);

    const hasFilter = useRef(Boolean(state?.filter));
    useEffect(() => {
        if (hasFilter.current) {
            // setFilterOpen(true);
            toSearch();
            hasFilter.current = false;
        }
    }, [toSearch]);

    const [sortIndex, setSortIndex] = useState(0);
    const sorted = useMemo(() => {
        const sort = SORTS[sortIndex] ?? SORTS[0];
        return orderBy(list, [sort.by], [sort.order]);
    }, [list, sortIndex]);

    // 对搜索结果的二次筛选（不重新查询，只筛当前结果）
    const [pickedCategories, setPickedCategories] = useState<string[]>([]);
    const [pickedTags, setPickedTags] = useState<string[]>([]);
    const [pickedType, setPickedType] = useState<BillType | undefined>();

    const toggle = useCallback(
        (setter: typeof setPickedCategories, id: string) => {
            setter((prev) =>
                prev.includes(id)
                    ? prev.filter((v) => v !== id)
                    : [...prev, id],
            );
        },
        [],
    );

    /** 结果中出现过的分类，按数量倒序 */
    const categoryFacets = useMemo(() => {
        const counts = new Map<string, number>();
        for (const bill of list) {
            counts.set(bill.categoryId, (counts.get(bill.categoryId) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([id, count]) => ({
                id,
                count,
                name: categories.find((c) => c.id === id)?.name ?? id,
            }))
            .sort((a, b) => b.count - a.count);
    }, [list, categories]);

    /** 结果中出现过的标签，按数量倒序 */
    const tagFacets = useMemo(() => {
        const counts = new Map<string, number>();
        for (const bill of list) {
            for (const id of bill.tagIds ?? []) {
                counts.set(id, (counts.get(id) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .map(([id, count]) => ({
                id,
                count,
                name: allTags.find((v) => v.id === id)?.name ?? id,
            }))
            .sort((a, b) => b.count - a.count);
    }, [list, allTags]);

    /** 结果中收入、支出各自的数量 */
    const typeFacets = useMemo(
        () =>
            (["expense", "income"] as const)
                .map((type) => ({
                    type,
                    count: list.filter((v) => v.type === type).length,
                }))
                .filter((v) => v.count > 0),
        [list],
    );

    const visible = useMemo(
        () =>
            sorted.filter(
                (bill) =>
                    (pickedType === undefined || bill.type === pickedType) &&
                    (pickedCategories.length === 0 ||
                        pickedCategories.includes(bill.categoryId)) &&
                    (pickedTags.length === 0 ||
                        pickedTags.some((t) => bill.tagIds?.includes(t))),
            ),
        [sorted, pickedType, pickedCategories, pickedTags],
    );

    /** 当前展示结果的收支合计 */
    const summary = useMemo(
        () =>
            visible.reduce(
                (prev, bill) => {
                    if (bill.type === "income") {
                        prev.income += bill.amount;
                    } else {
                        prev.expense += bill.amount;
                    }
                    return prev;
                },
                { income: 0, expense: 0 },
            ),
        [visible],
    );

    const [enableSelect, setEnableSelect] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const onSelectChange = (id: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((v) => v !== id);
            }
            return [...prev, id];
        });
    };
    const allSelected =
        selectedIds.length === 0
            ? false
            : selectedIds.length === visible.length
              ? true
              : "indeterminate";

    // 二次筛选后已选中的账单可能被隐藏，避免误操作到看不见的记录
    useEffect(() => {
        setSelectedIds([]);
    }, [pickedCategories, pickedTags, pickedType]);

    const toBatchDelete = async () => {
        await modal.prompt({
            title: t("batch-delete-confirm", {
                n: selectedIds.length,
            }),
        });
        setEnableSelect(false);
        await useLedgerStore.getState().removeBills(selectedIds);
        await toSearch();
    };
    const toBatchEdit = async () => {
        const initial = selectedIds.reduce(
            (prev, id, index) => {
                const bill = visible.find((v) => v.id === id);
                if (!bill) {
                    return prev;
                }
                if (index === 0) {
                    return {
                        type: bill.type,
                        categoryId: bill.categoryId,
                    };
                }
                return {
                    type: bill.type === prev.type ? bill.type : undefined,
                    categoryId:
                        bill.categoryId === prev.categoryId
                            ? bill.categoryId
                            : undefined,
                };
            },
            {
                type: undefined,
                categoryId: undefined,
            } as BatchEditOptions,
        );
        const edit = await showBatchEdit(initial);
        const updatedEntries = selectedIds
            .map((id) => {
                const bill = { ...visible.find((v) => v.id === id) } as Bill;
                if (!bill) {
                    return undefined;
                }
                if (edit.type !== undefined) {
                    const isTypeChanged = bill.type !== edit.type;
                    bill.type = edit.type;
                    if (edit.categoryId !== undefined) {
                        bill.categoryId = edit.categoryId;
                    } else if (isTypeChanged) {
                        const firstCategoryId = categories.find(
                            (c) => c.type === edit.type,
                        )!.id;
                        bill.categoryId = firstCategoryId;
                    }
                }
                if (edit.tagIds !== undefined) {
                    bill.tagIds = edit.tagIds;
                }
                return {
                    id: bill.id,
                    entry: bill,
                };
            })
            .filter((v) => v !== undefined);
        await useLedgerStore.getState().updateBills(updatedEntries);
        await toSearch();
    };
    return (
        <div className="w-full h-full p-2 flex justify-center overflow-hidden page-show">
            <div className="h-full w-full px-2 max-w-[600px] flex flex-col">
                <div className="search w-full flex justify-center pt-4">
                    <div className="w-full h-10 shadow-md rounded-sm flex items-center px-4 focus-within:(shadow-lg)">
                        <div className="flex-1">
                            <Clearable
                                visible={Boolean(form.comment?.length)}
                                onClear={() =>
                                    setForm((v) => ({
                                        ...v,
                                        comment: undefined,
                                    }))
                                }
                            >
                                <input
                                    value={form.comment ?? ""}
                                    type="text"
                                    maxLength={50}
                                    placeholder={t("search-placeholder")}
                                    className="w-full bg-transparent outline-none placeholder:text-foreground/40"
                                    onChange={(e) => {
                                        setForm((v) => ({
                                            ...v,
                                            comment: e.target.value,
                                        }));
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                            toSearch();
                                            setTimeout(() => {
                                                setSearched(true);
                                            }, 1000);
                                        }
                                    }}
                                />
                            </Clearable>
                        </div>
                        <Button
                            variant="ghost"
                            className="p-3 rounded-md"
                            onClick={() => {
                                toSearch();
                                setTimeout(() => {
                                    setSearched(true);
                                }, 1000);
                            }}
                        >
                            <i className="icon-[mdi--search]"></i>
                        </Button>
                    </div>
                </div>
                {/* quick time presets */}
                <div className="w-full flex gap-2 pt-3 pb-1 px-1 overflow-x-auto scrollbar-hidden text-xs">
                    {TIME_PRESETS.map((preset) => (
                        <Tag
                            key={preset.label}
                            checked={activePreset === preset.label}
                            onCheckedChange={() => applyPreset(preset)}
                            className="flex-shrink-0 text-xs bg-transparent shadow-md"
                        >
                            {t(preset.label)}
                        </Tag>
                    ))}
                </div>
                <Collapsible.Root
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    className="flex flex-col group pt-3 text-xs md:text-sm font-medium"
                >
                    <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                        <BillFilterForm form={form} setForm={setForm} />
                    </Collapsible.Content>
                    <div className="w-full flex justify-between px-2 pt-1">
                        <Button variant="ghost" onClick={toReset}>
                            {t("reset")}
                        </Button>
                        {searched && (
                            <Button
                                className="text-xs underline animate-content-show"
                                variant="ghost"
                                size="sm"
                                onClick={toSaveFilter}
                            >
                                <i className="icon-[mdi--coffee-to-go-outline]" />
                                {t("save-for-analyze")}
                            </Button>
                        )}

                        <HintTooltip
                            persistKey="filterHintShows"
                            content={"点击展开详细筛选面板"}
                        >
                            <Collapsible.Trigger asChild>
                                <Button variant="ghost">
                                    <i className="group-[[data-state=open]]:icon-[mdi--filter-variant-minus] group-[[data-state=closed]]:icon-[mdi--filter-variant-plus]"></i>
                                    {t("filter")}
                                </Button>
                            </Collapsible.Trigger>
                        </HintTooltip>
                    </div>
                </Collapsible.Root>
                {/* 对搜索结果的二次筛选 */}
                {list.length > 0 && (
                    <div className="w-full flex flex-col gap-1 pt-1 text-xs">
                        {typeFacets.length > 1 && (
                            <div className="flex gap-2 px-1 overflow-x-auto scrollbar-hidden">
                                {typeFacets.map(({ type, count }) => (
                                    <Tag
                                        key={type}
                                        checked={pickedType === type}
                                        onCheckedChange={() =>
                                            setPickedType((prev) =>
                                                prev === type
                                                    ? undefined
                                                    : type,
                                            )
                                        }
                                        className="flex-shrink-0 text-xs bg-transparent shadow-md"
                                    >
                                        {t(type)} {count}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {categoryFacets.length > 1 && (
                            <div className="flex items-center gap-2 px-1">
                                <i className="icon-[mdi--category-plus-outline] flex-shrink-0"></i>
                                <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden py-1">
                                    {categoryFacets.map((facet) => (
                                        <Tag
                                            key={facet.id}
                                            checked={pickedCategories.includes(
                                                facet.id,
                                            )}
                                            onCheckedChange={() =>
                                                toggle(
                                                    setPickedCategories,
                                                    facet.id,
                                                )
                                            }
                                            className="flex-shrink-0 text-xs bg-transparent shadow-md"
                                        >
                                            {facet.name} {facet.count}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        )}
                        {tagFacets.length > 0 && (
                            <div className="flex items-center gap-2 px-1">
                                <i className="icon-[mdi--tag-outline] flex-shrink-0"></i>
                                <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden py-1">
                                    {tagFacets.map((facet) => (
                                        <Tag
                                            key={facet.id}
                                            checked={pickedTags.includes(
                                                facet.id,
                                            )}
                                            onCheckedChange={() =>
                                                toggle(setPickedTags, facet.id)
                                            }
                                            className="flex-shrink-0 text-xs bg-transparent shadow-md"
                                        >
                                            {facet.name} {facet.count}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 当前展示结果的收支合计 */}
                        <div className="flex items-center gap-4 px-4 pt-1 text-foreground/80">
                            <div className="flex items-center gap-1">
                                {t("expense")}:
                                <Money
                                    value={amountToNumber(summary.expense)}
                                    largeAmountThreshold={100000}
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                {t("income")}:
                                <Money
                                    value={amountToNumber(summary.income)}
                                    largeAmountThreshold={100000}
                                />
                            </div>
                        </div>
                    </div>
                )}
                <div
                    className={cn(
                        "flex items-center justify-between px-4 text-xs text-foreground/80",
                        enableSelect && "pl-0",
                    )}
                >
                    <div className="flex gap-2 items-center">
                        {!enableSelect ? (
                            <>
                                {visible.length > 0 && (
                                    <Button
                                        className="p-1 h-fit"
                                        variant={"ghost"}
                                        size="sm"
                                        onClick={() => {
                                            setEnableSelect(true);
                                        }}
                                    >
                                        {t("multi-select")}
                                    </Button>
                                )}
                                {t("total-records", { n: visible.length })}
                            </>
                        ) : (
                            <>
                                <Checkbox
                                    checked={
                                        selectedIds.length === 0
                                            ? false
                                            : selectedIds.length ===
                                                visible.length
                                              ? true
                                              : "indeterminate"
                                    }
                                    onClick={() => {
                                        if (allSelected === true) {
                                            setSelectedIds([]);
                                        } else {
                                            setSelectedIds(
                                                visible.map((v) => v.id),
                                            );
                                        }
                                    }}
                                ></Checkbox>
                                <Button
                                    className="p-1 h-fit"
                                    variant={"ghost"}
                                    size="sm"
                                    onClick={() => {
                                        setEnableSelect(false);
                                        setSelectedIds([]);
                                    }}
                                >
                                    {t("cancel")}
                                </Button>
                                <span>
                                    {selectedIds.length}/{visible.length}
                                </span>
                                {selectedIds.length > 0 && (
                                    <>
                                        <Button
                                            className="p-1 h-fit"
                                            variant={"ghost"}
                                            size="sm"
                                            onClick={toBatchEdit}
                                        >
                                            {t("edit")}
                                        </Button>
                                        <Button
                                            className="p-1 h-fit text-destructive"
                                            variant={"ghost"}
                                            size="sm"
                                            onClick={toBatchDelete}
                                        >
                                            {t("delete")}
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setSortIndex((v) => {
                                    if (v === SORTS.length - 1) {
                                        return 0;
                                    }
                                    return v + 1;
                                });
                            }}
                        >
                            <i className={cn(SORTS[sortIndex].icon)}></i>
                            {t(SORTS[sortIndex].label)}
                        </Button>
                    </div>
                </div>
                <Ledger
                    bills={visible}
                    showTime
                    selectedIds={enableSelect ? selectedIds : undefined}
                    onSelectChange={onSelectChange}
                    afterEdit={toSearch}
                    showAssets={showAssets}
                />
            </div>
            <BatchEditProvider />
        </div>
    );
}
