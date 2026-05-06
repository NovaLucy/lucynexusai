import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./pwa";
import { initNative } from "./native";

initNative();

createRoot(document.getElementById("root")!).render(<App />);

