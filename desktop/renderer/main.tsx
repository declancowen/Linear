import { createRoot } from "react-dom/client"

import "./desktop-fonts.css"
import "@/app/globals.css"

import { DesktopApp } from "./desktop-app"

const root = document.getElementById("root")

if (!root) {
  throw new Error("Desktop renderer root element was not found")
}

createRoot(root).render(<DesktopApp />)
