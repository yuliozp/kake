"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { dictionaries } from "@/lib/i18n";

const Ctx = createContext({ lang: "es", t: dictionaries.es, setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("es");

  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem("kake-lang"); } catch {}
    const initial = saved === "en" || saved === "es" ? saved
      : navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
    setLang(initial);
    document.documentElement.lang = initial;
  }, []);

  function change(next) {
    setLang(next);
    try { localStorage.setItem("kake-lang", next); } catch {}
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
