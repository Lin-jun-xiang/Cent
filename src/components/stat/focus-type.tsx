import { useIntl } from "@/locale";
import { cn } from "@/utils";
import Money from "../money";

export const FocusTypes = ["income", "expense", "balance"] as const;
export type FocusType = (typeof FocusTypes)[number];

/**
 * 收支別切換：未選中時金額維持語意色（紅／綠）作為識別，
 * 選中時整顆填入主色，金額改用對比色以保證可讀性
 */
export function FocusTypeSelector({
    value: focusType,
    onValueChange: setFocusType,
    money,
}: {
    value: FocusType;
    onValueChange: (v: FocusType) => void;
    money: number[];
}) {
    const t = useIntl();
    const items = [
        {
            type: "income" as const,
            label: t("income"),
            value: money[0],
            sign: "+",
            valueClass: "text-semantic-income-strong",
        },
        {
            type: "expense" as const,
            label: t("expense"),
            value: money[1],
            sign: "-",
            valueClass: "text-semantic-expense-strong",
        },
        {
            type: "balance" as const,
            label: t("Balance"),
            value: money[2],
            sign: "",
            valueClass: "text-foreground",
        },
    ];
    return (
        <div className="flex items-center gap-1 p-1 rounded-full border border-border bg-card shadow-[var(--shadow-card)]">
            {items.map((item) => {
                const selected = focusType === item.type;
                return (
                    <button
                        key={item.type}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                            "min-w-[86px] px-3 py-1 rounded-full flex flex-col items-center justify-center cursor-pointer transition-colors",
                            selected
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted",
                        )}
                        onClick={() => setFocusType(item.type)}
                    >
                        <span
                            className={cn(
                                "text-sm font-semibold tnum",
                                selected
                                    ? "text-primary-foreground"
                                    : item.valueClass,
                            )}
                        >
                            {item.sign}
                            <Money
                                value={item.value}
                                largeAmountThreshold={100000}
                            />
                        </span>
                        <span
                            className={cn(
                                "text-[10px]",
                                selected
                                    ? "text-primary-foreground/75"
                                    : "text-muted-foreground",
                            )}
                        >
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
