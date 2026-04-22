import { cn } from "@/utils";

/** Fallback color when category has no color defined */
const DEFAULT_ICON_COLOR = "#6b7280"; // gray-500, visible on both light/dark

/**
 * Ensure an icon color is visible on both light and dark backgrounds.
 * Avoids pure black, pure white, and near-extremes.
 */
function safeColor(c: string | undefined): string {
    if (!c) return DEFAULT_ICON_COLOR;
    // Parse hex colors and clamp lightness away from extremes
    const hex = c.replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        // Perceived luminance (0–255)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // Too dark → brighten; too light → darken
        if (lum < 50) {
            const f = 50 / Math.max(lum, 1);
            return `rgb(${Math.min(255, Math.round(r * f + 30))}, ${Math.min(255, Math.round(g * f + 30))}, ${Math.min(255, Math.round(b * f + 30))})`;
        }
        if (lum > 210) {
            const f = 180 / Math.max(lum, 1);
            return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
        }
    }
    return c;
}

export default function CategoryIcon({
    icon,
    className,
    color,
}: {
    className?: string;
    icon: string;
    color?: string;
}) {
    // 判断是否为 <svg> 开头
    const isSvgString = icon.trim().startsWith("<svg");
    const safeC = safeColor(color);

    if (isSvgString) {
        const useMaskMode = icon.includes(`data-render="mask"`);
        const svgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(icon)}`;

        if (useMaskMode) {
            // 用于 mask 的 SVG 需为不透明形状，将 currentColor 改为 black 以保证遮罩正确
            const maskSvg = icon.replace(
                /\bfill=["']currentColor["']/gi,
                'fill="black"',
            );
            const maskSvgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(maskSvg)}`;
            return (
                <i
                    className={cn(
                        "inline-block w-4 h-4 min-w-4 min-h-4",
                        className,
                    )}
                    style={{
                        backgroundColor: safeC,
                        WebkitMaskImage: `url(${maskSvgSrc})`,
                        maskImage: `url(${maskSvgSrc})`,
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskSize: "100% 100%",
                        maskSize: "100% 100%",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                    }}
                />
            );
        }

        // 原有 background-image 模式
        return (
            <i
                className={cn(
                    "flex items-center justify-center min-w-4 min-h-4",
                    className,
                )}
                style={{
                    backgroundImage: `url(${svgSrc})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                }}
            />
        );
    } // 否则当作 className 使用 (iconify icons use mask + background-color: currentColor)
    return (
        <i
            className={cn(icon, className)}
            style={{ color: safeC, backgroundColor: safeC }}
        />
    );
}
