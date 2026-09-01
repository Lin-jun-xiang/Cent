import type { ButtonHTMLAttributes, DetailedHTMLProps, ReactNode } from "react";
import { cn } from "@/utils";

export default function Tag({
    checked,
    children,
    onCheckedChange,
    className,
    ...props
}: {
    checked?: boolean;
    children: ReactNode;
    className?: string;
    onCheckedChange?: (v: boolean) => void;
} & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
>) {
    return (
        <button
            type="button"
            {...props}
            data-state={checked ? "checked" : "uncheck"}
            className={cn(
                `rounded-full border py-1 px-2.5 flex items-center justify-center whitespace-nowrap cursor-pointer transition-colors`,
                "bg-card text-muted-foreground border-border hover:text-foreground",
                "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
                className,
            )}
            onMouseDown={() => {
                onCheckedChange?.(!checked);
            }}
        >
            {children}
        </button>
    );
}
