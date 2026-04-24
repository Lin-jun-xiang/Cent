import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCurrency } from "@/hooks/use-currency";
import { useReminders } from "@/hooks/use-reminders";
import { useWheelScrollX } from "@/hooks/use-wheel-scroll";
import PopupLayout from "@/layouts/popup-layout";
import { amountToNumber, numberToAmount } from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { categoriesGridClassName } from "@/ledger/utils";
import { useIntl } from "@/locale";
import type { EditBill } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { getPredictNow } from "@/utils/predict";
import { showTagList } from "../bill-tag";
import { showCategoryList } from "../category";
import { CategoryItem } from "../category/item";
import { DatePicker } from "../date-picker";
import Deletable from "../deletable";
import { FORMAT_IMAGE_SUPPORTED, showFilePicker } from "../file-picker";
import SmartImage from "../image";
import IOSUnscrolledInput from "../input";
import Calculator from "../keyboard";
import CurrentLocation from "../simple-location";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { goAddBill } from ".";
import { RemarkHint } from "./remark";
import ResizeHandle from "./resize";
import TagGroupSelector from "./tag-group";

const defaultBill = {
    type: "expense" as Bill["type"],
    comment: "",
    amount: 0,
    categoryId: ExpenseBillCategories[0].id,
};

export default function EditorForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: EditBill;
    onConfirm?: (v: Omit<Bill, "id" | "creatorId">) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const goBack = () => {
        onCancel?.();
    };

    const { baseCurrency, convert, quickCurrencies, allCurrencies } =
        useCurrency();

    const { incomes, expenses, categories: allCategories } = useCategory();

    const isCreate = edit === undefined;

    const predictCategory = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.category?.[0];
        if (!pc) {
            return;
        }
        const category = allCategories.find((v) => v.id === pc);
        return category;
    }, [isCreate, allCategories]);

    const predictComments = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.comment;
        return pc;
    }, [isCreate]);

    const getMatchDefaultCategory = (categoryId: string) => {
        const category = [...incomes, ...expenses].find(
            (c) => c.id === categoryId,
        );
        if (!category) {
            return categoryId;
        }
        const defaultSub = category.children.find((v) => v.defaultSelect);
        if (!defaultSub) {
            return categoryId;
        }
        return defaultSub.id;
    };
    const [billState, setBillState] = useState(() => {
        const init = {
            ...defaultBill,
            time: Date.now(),
            ...edit,
            categoryId:
                predictCategory?.id ??
                getMatchDefaultCategory(
                    edit?.categoryId ?? defaultBill.categoryId,
                ),
        };
        if (edit?.currency?.target === baseCurrency.id) {
            delete init.currency;
        }
        return init;
    });

    const handleParentCategoryClick = (parentCategoryId: string) => {
        // 点击父类时，如果此前选中的【是该父类的子类】，则直接选中该父类
        // 否则选中该父类的 MatchDefault 类别
        setBillState((prev) => {
            const parentCategory = [...incomes, ...expenses].find(
                (c) => c.id === parentCategoryId,
            );
            const isPrevParentsChild = parentCategory?.children.some(
                (c) => c.id === prev.categoryId,
            );
            if (isPrevParentsChild) {
                return {
                    ...prev,
                    categoryId: parentCategoryId,
                };
            }
            return {
                ...prev,
                categoryId: getMatchDefaultCategory(parentCategoryId),
            };
        });
    };

    const categories = billState.type === "expense" ? expenses : incomes;

    const subCategories = useMemo(() => {
        const selected = categories.find(
            (c) =>
                c.id === billState.categoryId ||
                c.children.some((s) => s.id === billState.categoryId),
        );
        if (selected?.children) {
            return selected.children;
        }
        return categories.find((c) => c.id === selected?.parent)?.children;
    }, [billState.categoryId, categories]);

    const toConfirm = useCallback(() => {
        if (reminderSubmitRef.current) {
            reminderSubmitRef.current();
            return;
        }
        onConfirm?.({
            ...billState,
        });
    }, [onConfirm, billState]);

    const reminderSubmitRef = useRef<(() => void) | null>(null);

    const chooseImage = async () => {
        const [file] = await showFilePicker({ accept: FORMAT_IMAGE_SUPPORTED });
        setBillState((v) => {
            return { ...v, images: [...(v.images ?? []), file] };
        });
    };

    const locationRef = useRef<HTMLButtonElement>(null);
    const isAdd = useRef(!edit);
    useEffect(() => {
        if (
            !isAdd.current ||
            !usePreferenceStore.getState().autoLocateWhenAddBill
        ) {
            return;
        }
        locationRef.current?.click?.();
    }, []);

    const monitorRef = useRef<HTMLButtonElement>(null);
    const [monitorFocused, setMonitorFocused] = useState(false);
    useEffect(() => {
        monitorRef.current?.focus?.();
    }, []);

    useEffect(() => {
        if (monitorFocused) {
            const onPress = (event: KeyboardEvent) => {
                const key = event.key;
                if (key === "Enter") {
                    toConfirm();
                }
            };
            document.addEventListener("keypress", onPress);
            return () => {
                document.removeEventListener("keypress", onPress);
            };
        }
    }, [monitorFocused, toConfirm]);

    const targetCurrency =
        allCurrencies.find(
            (c) => c.id === (billState.currency?.target ?? baseCurrency.id),
        ) ?? baseCurrency;

    const changeCurrency = (newCurrencyId: string) =>
        setBillState((prev) => {
            if (newCurrencyId === baseCurrency.id) {
                return {
                    ...prev,
                    amount: prev.currency?.amount ?? prev.amount,
                    currency: undefined,
                };
            }
            const { predict } = convert(
                amountToNumber(prev.currency?.amount ?? prev.amount),
                newCurrencyId,
                baseCurrency.id,
                prev.time,
            );
            return {
                ...prev,
                amount: numberToAmount(predict),
                currency: {
                    base: baseCurrency.id,
                    target: newCurrencyId,
                    amount: prev.currency?.amount ?? prev.amount,
                },
            };
        });

    const calculatorInitialValue = billState?.currency
        ? amountToNumber(billState.currency.amount)
        : billState?.amount
          ? amountToNumber(billState?.amount)
          : 0;

    const multiplyKey = usePreferenceStore((v) => {
        if (!v.multiplyKey || v.multiplyKey === "off") {
            return undefined;
        }
        if (v.multiplyKey === "double-zero") {
            return "double-zero";
        }
        return "triple-zero";
    });

    const tagSelectorRef = useRef<HTMLDivElement>(null);
    useWheelScrollX(tagSelectorRef);

    // --- 提醒模式 ---
    // 在編輯已存在帳單時不允許切換到提醒（只有新增才有三個模式）
    type EditorMode = "expense" | "income" | "reminder";
    const [mode, setMode] = useState<EditorMode>(
        (edit as any)?._mode === "reminder"
            ? "reminder"
            : (billState.type as EditorMode),
    );

    // 提醒相關狀態
    const { add: addReminder } = useReminders();
    const { id: currentUserId } = useUserStore();
    const creators = useCreators();
    const [reminderTitle, setReminderTitle] = useState<string>("");
    const [reminderTime, setReminderTime] = useState<number>(() => {
        // 預設：今日中午 12:00（台灣時間 ≈ 本地時間）
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        return d.getTime();
    });
    // 預設「全部」：所有協作者 + 自己（去重）
    const allTargetIds = useMemo(() => {
        const ids: (number | string)[] = [currentUserId];
        for (const c of creators) {
            if (!ids.some((x) => String(x) === String(c.id))) {
                ids.push(c.id);
            }
        }
        return ids;
    }, [creators, currentUserId]);
    const [reminderTargets, setReminderTargets] = useState<(number | string)[]>(
        () => [currentUserId],
    );
    const targetsTouchedRef = useRef(false);
    // 協作者載入/變化時，若使用者尚未手動調整，同步為「全部」
    useEffect(() => {
        if (!targetsTouchedRef.current) {
            setReminderTargets(allTargetIds);
        }
    }, [allTargetIds]);
    const [reminderComment, setReminderComment] = useState<string>("");
    const [reminderPriority, setReminderPriority] = useState<
        "important" | "normal"
    >("normal");

    const toggleReminderTarget = useCallback((id: number | string) => {
        targetsTouchedRef.current = true;
        setReminderTargets((prev) => {
            if (prev.some((p) => String(p) === String(id))) {
                return prev.filter((p) => String(p) !== String(id));
            }
            return [...prev, id];
        });
    }, []);

    // 保持 billState.type 與 mode 同步（若為 expense/income）
    useEffect(() => {
        if (mode === "expense" || mode === "income") {
            setBillState((v) =>
                v.type === mode
                    ? v
                    : {
                          ...v,
                          type: mode,
                          categoryId:
                              mode === "expense"
                                  ? ExpenseBillCategories[0].id
                                  : IncomeBillCategories[0].id,
                      },
            );
        }
    }, [mode]);

    // reminder 模式下的提交邏輯
    useEffect(() => {
        if (mode !== "reminder") {
            reminderSubmitRef.current = null;
            return;
        }
        reminderSubmitRef.current = () => {
            if (!reminderTitle.trim()) return;
            addReminder({
                title: reminderTitle.trim(),
                time: reminderTime,
                targets:
                    reminderTargets.length > 0
                        ? reminderTargets
                        : [currentUserId],
                comment: reminderComment.trim() || undefined,
                creatorId: currentUserId,
                priority: reminderPriority,
            });
            // 關閉彈窗（不儲存帳單）
            onCancel?.();
        };
        return () => {
            reminderSubmitRef.current = null;
        };
    }, [
        mode,
        reminderTitle,
        reminderTime,
        reminderTargets,
        reminderComment,
        reminderPriority,
        currentUserId,
        addReminder,
        onCancel,
    ]);

    return (
        <Calculator.Root
            multiplyKey={multiplyKey}
            initialValue={calculatorInitialValue}
            onValueChange={(n) => {
                setBillState((v) => {
                    if (v.currency) {
                        const { predict } = convert(
                            n,
                            v.currency.target,
                            v.currency.base,
                            v.time,
                        );
                        return {
                            ...v,
                            amount: numberToAmount(predict),
                            currency: {
                                ...v.currency,
                                amount: numberToAmount(n),
                            },
                        };
                    }
                    return {
                        ...v,
                        amount: numberToAmount(n),
                    };
                });
            }}
            input={monitorFocused}
        >
            <PopupLayout
                className="h-full gap-2 pb-0 scrollbar-hidden"
                onBack={goBack}
                title={
                    <div className="pl-[54px] w-full min-h-12 rounded-lg flex pt-2 pb-0 overflow-hidden scrollbar-hidden">
                        <div className="text-stone-800 dark:text-white">
                            <div className="w-[136px] h-12 relative bg-stone-200 dark:bg-stone-900 rounded-lg p-1 flex items-center gap-1">
                                {(
                                    [
                                        {
                                            key: "expense",
                                            label: t("expense"),
                                            bg: "bg-semantic-expense",
                                        },
                                        {
                                            key: "income",
                                            label: t("income"),
                                            bg: "bg-semantic-income",
                                        },
                                        {
                                            key: "reminder",
                                            label: t("reminder") ?? "提醒",
                                            bg: "bg-amber-500",
                                        },
                                    ] as const
                                ).map((item) => {
                                    const active = mode === item.key;
                                    return (
                                        <button
                                            type="button"
                                            key={item.key}
                                            onClick={() =>
                                                setMode(item.key as EditorMode)
                                            }
                                            className={cn(
                                                "flex-1 h-full flex items-center justify-center rounded-md text-[9px] transition-all",
                                                active
                                                    ? `${item.bg} text-white font-medium`
                                                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800",
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex-1 flex bg-stone-200 dark:bg-stone-400 focus:outline rounded-lg ml-2 px-2 relative">
                            {quickCurrencies.length > 0 && (
                                <Select
                                    value={targetCurrency?.id}
                                    onValueChange={(newCurrencyId) => {
                                        changeCurrency(newCurrencyId);
                                    }}
                                >
                                    <div className="flex items-center">
                                        <SelectTrigger className="w-fit outline-none ring-none border-none shadow-none p-0 [&_svg]:hidden">
                                            <div className="flex items-center font-semibold text-2xl text-stone-800 dark:text-white">
                                                {targetCurrency?.symbol}
                                            </div>
                                        </SelectTrigger>
                                    </div>
                                    <SelectContent>
                                        {quickCurrencies.map((currency) => (
                                            <SelectItem
                                                key={currency.id}
                                                value={currency.id}
                                            >
                                                {currency.label}
                                                {`(${currency.symbol})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <button
                                ref={monitorRef}
                                type="button"
                                onFocus={() => {
                                    setMonitorFocused(true);
                                }}
                                onBlur={() => {
                                    setMonitorFocused(false);
                                }}
                                className="flex-1 flex flex-col justify-center items-end overflow-x-scroll outline-none"
                            >
                                {billState.currency && (
                                    <div className="absolute text-stone-500 dark:text-white text-[8px] top-0">
                                        ≈ {baseCurrency.symbol}{" "}
                                        {amountToNumber(billState.amount)}{" "}
                                        {baseCurrency.label}
                                    </div>
                                )}
                                <Calculator.Value
                                    className={cn(
                                        "text-stone-800 dark:text-white text-3xl font-semibold text-right bg-transparent after:inline-block after:content-['|'] after:opacity-0 after:font-thin after:translate-y-[-3px] ",
                                        monitorFocused &&
                                            "after:animate-caret-blink",
                                    )}
                                ></Calculator.Value>
                                {billState.amount < 0 && (
                                    <div className="absolute text-red-700 text-[8px] bottom-0">
                                        {t("bill-negative-tip")}
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                }
            >
                {mode === "reminder" ? (
                    <ReminderModeBody
                        t={t}
                        title={reminderTitle}
                        setTitle={setReminderTitle}
                        time={reminderTime}
                        setTime={setReminderTime}
                        targets={reminderTargets}
                        toggleTarget={toggleReminderTarget}
                        comment={reminderComment}
                        setComment={setReminderComment}
                        priority={reminderPriority}
                        setPriority={setReminderPriority}
                        currentUserId={currentUserId}
                        creators={creators}
                        onConfirm={toConfirm}
                    />
                ) : (
                    <>
                        {/* categories */}
                        <div className="flex-1 flex-shrink-0 overflow-y-auto min-h-[80px] scrollbar-hidden flex flex-col px-2 text-sm font-medium gap-2">
                            <div className="flex flex-col min-h-[80px] grow-[2] shrink overflow-y-auto scrollbar-hidden w-full">
                                <div
                                    className={cn(
                                        "grid gap-1",
                                        categoriesGridClassName(categories),
                                    )}
                                >
                                    {categories.map((item) => (
                                        <CategoryItem
                                            key={item.id}
                                            category={item}
                                            selected={
                                                billState.categoryId === item.id
                                            }
                                            onMouseDown={() => {
                                                handleParentCategoryClick(
                                                    item.id,
                                                );
                                            }}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        className={cn(
                                            `rounded-lg border flex-1 py-1 px-2 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                                        )}
                                        onClick={() => {
                                            showCategoryList(billState.type);
                                        }}
                                    >
                                        <i className="icon-[mdi--settings]"></i>
                                        {t("edit")}
                                    </button>
                                </div>
                            </div>
                            {(subCategories?.length ?? 0) > 0 && (
                                <div className="flex flex-col min-h-[68px] grow-[1] shrink max-h-fit overflow-y-auto rounded-md border p-2 shadow scrollbar-hidden">
                                    <div
                                        className={cn(
                                            "grid gap-1",
                                            categoriesGridClassName(
                                                subCategories,
                                            ),
                                        )}
                                    >
                                        {subCategories?.map((subCategory) => {
                                            return (
                                                <CategoryItem
                                                    key={subCategory.id}
                                                    category={subCategory}
                                                    selected={
                                                        billState.categoryId ===
                                                        subCategory.id
                                                    }
                                                    onMouseDown={() => {
                                                        setBillState((v) => ({
                                                            ...v,
                                                            categoryId:
                                                                subCategory.id,
                                                        }));
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* tags */}
                        <div
                            ref={tagSelectorRef}
                            className="w-full h-[40px] flex-shrink-0 flex-grow-0 flex gap-1 py-1 items-center overflow-x-auto px-2 text-sm font-medium scrollbar-hidden"
                        >
                            <TagGroupSelector
                                isCreate={isCreate}
                                selectedTags={billState.tagIds}
                                onSelectChange={(newTagIds, extra) => {
                                    setBillState((prev) => ({
                                        ...prev,
                                        tagIds: newTagIds,
                                    }));
                                    if (extra?.preferCurrency) {
                                        changeCurrency(extra.preferCurrency);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className={cn(
                                    `rounded-lg border py-1 px-2 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                                )}
                                onClick={() => {
                                    showTagList();
                                }}
                            >
                                <i className="icon-[mdi--tag-text-outline]"></i>
                                {t("edit-tags")}
                            </button>
                        </div>
                        {/* keyboard area */}{" "}
                        <div
                            className={cn(
                                "h-[calc(480px+160px*(var(--bekh,0.5)-0.5))] sm:h-[calc(380px+160px*(var(--bekh,0.5)-0.5))] min-h-[264px] max-h-[calc(100%-124px)]",
                                "keyboard-field relative flex gap-2 flex-col justify-start bg-gradient-to-b from-stone-100 to-stone-200 text-stone-800 dark:from-teal-900 dark:to-teal-950 dark:text-white sm:rounded-b-md p-2 pb-[max(env(safe-area-inset-bottom),8px)]",
                            )}
                        >
                            <ResizeHandle />
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center h-10">
                                    <div className="flex items-center h-full">
                                        {(billState.images?.length ?? 0) >
                                            0 && (
                                            <div className="pr-2 flex gap-[6px] items-center overflow-x-auto max-w-22 h-full scrollbar-hidden">
                                                {billState.images?.map(
                                                    (img, index) => (
                                                        <Deletable
                                                            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                                                            key={index}
                                                            onDelete={() => {
                                                                setBillState(
                                                                    (v) => ({
                                                                        ...v,
                                                                        images: v.images?.filter(
                                                                            (
                                                                                m,
                                                                            ) =>
                                                                                m !==
                                                                                img,
                                                                        ),
                                                                    }),
                                                                );
                                                            }}
                                                        >
                                                            <SmartImage
                                                                source={img}
                                                                alt=""
                                                                className="w-6 h-6 object-cover rounded"
                                                            />
                                                        </Deletable>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                        {(billState.images?.length ?? 0) <
                                            3 && (
                                            <button
                                                type="button"
                                                className="px-1 flex justify-center items-center rounded-full transition-all cursor-pointer"
                                                onClick={chooseImage}
                                            >
                                                <i className="icon-xs icon-[mdi--image-plus-outline] text-[white]"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="h-full flex items-center">
                                        {billState?.location ? (
                                            <Deletable
                                                onDelete={() => {
                                                    setBillState((prev) => {
                                                        return {
                                                            ...prev,
                                                            location: undefined,
                                                        };
                                                    });
                                                }}
                                            >
                                                <i className="w-5 icon-[mdi--location-radius]"></i>
                                            </Deletable>
                                        ) : (
                                            <CurrentLocation
                                                ref={locationRef}
                                                className="px-1 flex items-center justify-center"
                                                onValueChange={(v) => {
                                                    setBillState((prev) => {
                                                        return {
                                                            ...prev,
                                                            location: v,
                                                        };
                                                    });
                                                }}
                                            >
                                                <i className="icon-[mdi--add-location]" />
                                            </CurrentLocation>
                                        )}
                                    </div>
                                    <div className="rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500)">
                                        <DatePicker
                                            fixedTime
                                            value={billState.time}
                                            onChange={(time) => {
                                                setBillState((prev) => {
                                                    if (!prev.currency) {
                                                        return {
                                                            ...prev,
                                                            time: time,
                                                        };
                                                    }
                                                    const { predict } = convert(
                                                        amountToNumber(
                                                            prev.currency
                                                                ?.amount ??
                                                                prev.amount,
                                                        ),
                                                        prev.currency.target,
                                                        baseCurrency.id,
                                                        time,
                                                    );
                                                    return {
                                                        ...prev,
                                                        time: time,
                                                        amount: numberToAmount(
                                                            predict,
                                                        ),
                                                        currency: {
                                                            base: baseCurrency.id,
                                                            target: prev
                                                                .currency
                                                                .target,
                                                            amount:
                                                                prev.currency
                                                                    ?.amount ??
                                                                prev.amount,
                                                        },
                                                    };
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <RemarkHint
                                    recommends={predictComments}
                                    onSelect={(v) => {
                                        setBillState((prev) => ({
                                            ...prev,
                                            comment: `${prev.comment} ${v}`,
                                        }));
                                    }}
                                >
                                    <div className="flex h-full flex-1">
                                        <IOSUnscrolledInput
                                            value={billState.comment}
                                            onChange={(e) => {
                                                setBillState((v) => ({
                                                    ...v,
                                                    comment: e.target.value,
                                                }));
                                            }}
                                            type="text"
                                            className="w-full bg-transparent text-stone-800 dark:text-white text-right placeholder-opacity-50 outline-none"
                                            placeholder={t("comment")}
                                            enterKeyHint="done"
                                        />
                                    </div>
                                </RemarkHint>
                            </div>{" "}
                            <button
                                type="button"
                                className="flex h-[80px] min-h-[48px] justify-center items-center bg-teal-600 hover:bg-teal-500 dark:bg-gradient-to-r dark:from-teal-700 dark:to-teal-600 rounded-xl font-bold text-lg text-white cursor-pointer shadow-md shadow-teal-700/20 active:scale-[0.98] transition-all"
                                onClick={toConfirm}
                            >
                                <i className="icon-[mdi--check] icon-md"></i>
                            </button>
                            <Calculator.Keyboard
                                className={cn("flex-1")}
                                onKey={(v) => {
                                    if (v === "r") {
                                        toConfirm();
                                        setTimeout(() => {
                                            goAddBill();
                                        }, 10);
                                    }
                                }}
                            />
                        </div>
                    </>
                )}
            </PopupLayout>
        </Calculator.Root>
    );
}

function ReminderModeBody({
    t,
    title,
    setTitle,
    time,
    setTime,
    targets,
    toggleTarget,
    comment,
    setComment,
    priority,
    setPriority,
    currentUserId,
    creators,
    onConfirm,
}: {
    t: (key: string, p?: Record<string, any>) => string;
    title: string;
    setTitle: (v: string) => void;
    time: number;
    setTime: (v: number) => void;
    targets: (number | string)[];
    toggleTarget: (id: number | string) => void;
    comment: string;
    setComment: (v: string) => void;
    priority: "important" | "normal";
    setPriority: (v: "important" | "normal") => void;
    currentUserId: number | string;
    creators: { id: number | string; name: string }[];
    onConfirm: () => void;
}) {
    const isSelected = (id: number | string) =>
        targets.some((p) => String(p) === String(id));
    const selfIncluded = creators.some(
        (c) => String(c.id) === String(currentUserId),
    );
    const formatDT = (ts: number) => {
        const d = new Date(ts);
        const pad = (n: number) => `${n}`.padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return (
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-3 pb-4">
            <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">
                    {t("reminder-title") ?? "提醒標題"}
                </div>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                        t("reminder-title-placeholder") ?? "例如：美髮"
                    }
                    autoFocus
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">
                    {t("reminder-priority") ?? "重要性"}
                </div>
                <div className="flex gap-1.5">
                    {(
                        [
                            {
                                key: "important",
                                label:
                                    t("reminder-priority-important") ?? "重要",
                                icon: "icon-[mdi--alert-circle]",
                                color: "text-rose-500",
                                active: "bg-rose-500 text-white border-rose-500",
                            },
                            {
                                key: "normal",
                                label: t("reminder-priority-normal") ?? "一般",
                                icon: "icon-[mdi--calendar-clock-outline]",
                                color: "text-amber-500",
                                active: "bg-amber-500 text-white border-amber-500",
                            },
                        ] as const
                    ).map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPriority(p.key)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-md border transition-colors",
                                priority === p.key
                                    ? p.active
                                    : "bg-muted text-muted-foreground border-transparent",
                            )}
                        >
                            <i
                                className={cn(
                                    "size-4",
                                    p.icon,
                                    priority === p.key ? "" : p.color,
                                )}
                            />
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">
                    {t("reminder-time") ?? "提醒時間"}
                </div>
                <div className="border rounded-md px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {formatDT(time)}
                    </span>
                    <DatePicker value={time} fixedTime onChange={setTime}>
                        <Button variant="outline" size="sm" type="button">
                            <i className="icon-[mdi--calendar-edit] size-4" />
                        </Button>
                    </DatePicker>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">
                    {t("reminder-targets") ?? "提醒人"}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {!selfIncluded && (
                        <button
                            type="button"
                            onClick={() => toggleTarget(currentUserId)}
                            className={cn(
                                "text-xs px-3 py-1 rounded-full border transition-colors",
                                isSelected(currentUserId)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-transparent",
                            )}
                        >
                            {t("me") ?? "我"}
                        </button>
                    )}
                    {creators.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleTarget(c.id)}
                            className={cn(
                                "text-xs px-3 py-1 rounded-full border transition-colors",
                                isSelected(c.id)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-transparent",
                            )}
                        >
                            {String(c.id) === String(currentUserId)
                                ? (t("me") ?? "我")
                                : c.name}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">{t("comment")}</div>
                <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                        t("reminder-comment-placeholder") ??
                        "跟 eva 約西門捷運站出口"
                    }
                />
            </div>
            <div className="flex-1" />
            <button
                type="button"
                onClick={onConfirm}
                disabled={!title.trim()}
                className={cn(
                    "h-12 rounded-xl font-bold text-white transition-all active:scale-[0.98] shadow-md",
                    title.trim()
                        ? "bg-amber-500 hover:bg-amber-400 shadow-amber-500/20 cursor-pointer"
                        : "bg-amber-500/40 cursor-not-allowed",
                )}
            >
                {t("confirm") ?? "確定"}
            </button>
        </div>
    );
}
