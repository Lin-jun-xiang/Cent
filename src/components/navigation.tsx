import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import ComplexAddButton from "./add-button";
import { goAddBill } from "./bill-editor";
import { afterAddBillPromotion } from "./promotion";
import { showSettings } from "./settings";

export default function Navigation() {
    const location = useLocation();
    const navigate = useNavigate();

    const currentTab = useMemo(() => {
        return ["/stat", "/", "/search"].find((x) => location.pathname === x);
    }, [location.pathname]);

    const switchTab = (value: "/" | "/stat" | "/search") => {
        navigate(`${value}`);
    };
    return createPortal(
        <div
            className="floating-tab fixed w-screen h-18 flex items-center justify-around sm:h-screen
         sm:w-18 sm:flex-col sm:justify-start z-[0] 
         bottom-[calc(.25rem+env(safe-area-inset-bottom))]
         sm:top-[env(safe-area-inset-top)] sm:left-[calc(.25rem+env(safe-area-inset-left))]"
        >
            {/* search */}
            <button
                type="button"
                className={`w-14 h-14 sm:w-10 sm:h-10 cursor-pointer flex items-center justify-center rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 m-2 transition-all duration-200 backdrop-blur-xl hover:scale-105 active:scale-95 ${
                    currentTab === "/search"
                        ? "bg-foreground/15 dark:bg-white/20"
                        : "bg-background/80 dark:bg-white/10"
                }`}
                onClick={() => switchTab("/search")}
            >
                <i className="icon-[mdi--search] size-5"></i>
            </button>

            {/* middle group */}
            <div className="flex items-center rounded-2xl p-1.5 bg-background/80 dark:bg-white/10 backdrop-blur-xl w-56 h-14 m-2 shadow-lg shadow-black/5 dark:shadow-black/20 sm:flex-col sm:w-10 sm:h-50 sm:-order-1">
                <button
                    type="button"
                    className={`flex-1 h-full w-full transition-all duration-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-foreground/8 active:scale-95 ${
                        currentTab === "/"
                            ? "bg-foreground/12 dark:bg-white/15 shadow-sm"
                            : ""
                    }`}
                    onClick={() => switchTab("/")}
                >
                    <i className="icon-[mdi--format-align-center] size-5"></i>
                </button>

                <ComplexAddButton
                    onClick={() => {
                        goAddBill();
                        afterAddBillPromotion();
                    }}
                />

                <button
                    type="button"
                    className={`flex-1 h-full w-full transition-all duration-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-foreground/8 active:scale-95 ${
                        currentTab === "/stat"
                            ? "bg-foreground/12 dark:bg-white/15 shadow-sm"
                            : ""
                    }`}
                    onClick={() => switchTab("/stat")}
                >
                    {/* <div className="transform translate-x-[25%] translate-y-[-25%]"> */}
                    <i className="icon-[mdi--chart-box-outline] size-5"></i>
                    {/* </div> */}
                </button>
            </div>

            {/* settings */}
            <button
                type="button"
                className="w-14 h-14 sm:w-10 sm:h-10 cursor-pointer flex items-center justify-center rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 m-2 transition-all duration-200 bg-background/80 dark:bg-white/10 backdrop-blur-xl hover:scale-105 active:scale-95"
                onClick={() => {
                    showSettings();
                }}
            >
                <i className="icon-[mdi--more-horiz] size-5"></i>
            </button>
        </div>,
        document.body,
    );
}
