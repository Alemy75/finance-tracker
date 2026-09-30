import type { ComponentType } from "react";
import { IconHome, IconList, IconSettings, IconTarget } from "@/components/ui/icons";
import type { IconProps } from "@/components/ui/icons";

export type Page = "home" | "history" | "goals" | "settings";

export const pages: { id: Page; label: string; icon: ComponentType<IconProps> }[] = [
  { id: "home", label: "Главная", icon: IconHome },
  { id: "history", label: "История", icon: IconList },
  { id: "goals", label: "Цели", icon: IconTarget },
  { id: "settings", label: "Настройки", icon: IconSettings }
];
