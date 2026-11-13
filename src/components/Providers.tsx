"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import TableCellNavigator from "@/components/TableCellNavigator";

function ThemedToaster() {
  const { isDark } = useTheme();

  const baseStyle = isDark
    ? {
        background: "#152033",
        color: "#f1f5f9",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        lineHeight: 1.45,
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        boxShadow:
          "0 14px 36px -10px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(148, 163, 184, 0.08)",
        maxWidth: "min(420px, calc(100vw - 24px))",
      }
    : {
        background: "#ffffff",
        color: "#27272a",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        lineHeight: 1.45,
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #e4e4e7",
        boxShadow:
          "0 10px 30px -10px rgba(24, 24, 27, 0.12), 0 0 0 1px rgba(24, 24, 27, 0.04)",
        maxWidth: "min(420px, calc(100vw - 24px))",
      };

  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={10}
      containerClassName="app-toast-container"
      containerStyle={{
        top: 16,
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 3200,
        className: "app-toast",
        style: baseStyle,
        success: {
          duration: 2800,
          iconTheme: {
            primary: isDark ? "#34d399" : "#059669",
            secondary: isDark ? "#08281e" : "#ecfdf5",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#08281e",
                color: "#ecfdf5",
                border: "1px solid rgba(52, 211, 153, 0.36)",
                boxShadow:
                  "0 14px 36px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(16, 185, 129, 0.14)",
              }
            : {
                ...baseStyle,
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #6ee7b7",
                boxShadow: "0 12px 30px -12px rgba(5, 150, 105, 0.22)",
              },
        },
        error: {
          duration: 4200,
          iconTheme: {
            primary: "#f43f5e",
            secondary: isDark ? "#2c0d18" : "#fff1f2",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#2c0d18",
                color: "#ffe4e6",
                border: "1px solid rgba(251, 113, 133, 0.38)",
                boxShadow:
                  "0 14px 36px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(244, 63, 94, 0.16)",
              }
            : {
                ...baseStyle,
                background: "#fff1f2",
                color: "#9f1239",
                border: "1px solid #fda4af",
                boxShadow: "0 12px 30px -12px rgba(244, 63, 94, 0.2)",
              },
        },
        loading: {
          duration: Infinity,
          iconTheme: {
            primary: isDark ? "#38bdf8" : "#3b82f6",
            secondary: isDark ? "#0e1f33" : "#eff6ff",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#0e1f33",
                color: "#e0f2fe",
                border: "1px solid rgba(56, 189, 248, 0.34)",
              }
            : {
                ...baseStyle,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
              },
        },
        blank: {
          style: baseStyle,
        },
      }}
    />
  );
}

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TableCellNavigator />
        {children}
        <ThemedToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
