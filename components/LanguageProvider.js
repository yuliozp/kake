"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { dictionaries } from "@/lib/i18n";

const Ctx = createContext({ lang: "es", t: dictionaries.es, setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("es");

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("kake-lang");
    if (saved === "en" || saved === "es") setLang(saved);
    else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")) setLang("en");
  }, []);

  function change(next) {
    setLang(next);
    localStorage.setItem("kake-lang", next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }

  return (
    <Ctx.Provider value={{ lang, t: dictionaries[lang], setLang: change }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  return useContext(Ctx);
}
