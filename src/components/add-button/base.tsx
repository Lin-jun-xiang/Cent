import type { HtmlHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils";

export function BaseButton({
    children,
    className,
    ...props
}: { children?: ReactNode } & HtmlHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            className={cn(
                "w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-600/30 flex items-center justify-center m-1 cursor-pointer transform transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-teal-500/40",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
