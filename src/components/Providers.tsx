"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";

function ThemedToaster() {
  const { isDark } = useTheme();

  const baseStyle = isDark
    ? {
        background: "#0f172a",
        color: "#f8fafc",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        lineHeight: 1.45,
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid rgba(148, 163, 184, 0.22)",
        boxShadow:
          "0 10px 40px -12px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(15, 23, 42, 0.06)",
        maxWidth: "min(420px, calc(100vw - 24px))",
      }
    : {
        background: "#ffffff",
        color: "#0f172a",
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        lineHeight: 1.45,
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #cbd5e1",
        boxShadow:
          "0 10px 30px -10px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.04)",
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
            primary: "#10b981",
            secondary: "#ecfdf5",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#052e1c",
                color: "#ecfdf5",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                boxShadow:
                  "0 12px 40px -14px rgba(5, 46, 28, 0.55), 0 0 0 1px rgba(16, 185, 129, 0.12)",
              }
            : {
                ...baseStyle,
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #6ee7b7",
                boxShadow: "0 12px 30px -12px rgba(16, 185, 129, 0.22)",
              },
        },
        error: {
          duration: 4200,
          iconTheme: {
            primary: "#f43f5e",
            secondary: "#fff1f2",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#4c0519",
                color: "#ffe4e6",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                boxShadow:
                  "0 12px 40px -14px rgba(76, 5, 25, 0.55), 0 0 0 1px rgba(244, 63, 94, 0.12)",
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
            primary: isDark ? "#38bdf8" : "#0284c7",
            secondary: isDark ? "#0c4a6e" : "#e0f2fe",
          },
          style: isDark
            ? {
                ...baseStyle,
                background: "#0c1a2e",
                color: "#e0f2fe",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }
            : {
                ...baseStyle,
                background: "#f0f9ff",
                color: "#075985",
                border: "1px solid #7dd3fc",
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
        {children}
        <ThemedToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
