import React, { useReducer } from "react";

export type Toggles = { speed: boolean; accel: boolean; skills: boolean; slopes: boolean; blocked: boolean; course: boolean; positionKeep: boolean; hp: boolean; heuristics: boolean; skillDuration: boolean; minimap: boolean };

export function useToggles(initial?: Partial<Toggles>) {
    const [t, set] = useReducer(
        (s: Toggles, a: Partial<Toggles>) => ({ ...s, ...a }),
        { speed: true, accel: true, skills: true, slopes: true, blocked: true, course: true, positionKeep: true, hp: true, heuristics: true, skillDuration: true, minimap: true, ...(initial || {}) }
    );
    const bind = (k: keyof Toggles) => ({
        checked: t[k],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.checked } as Partial<Toggles>),
    });
    return { t, bind };
}
