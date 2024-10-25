import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Map from "./map/tsx";
import Test from "./map/test";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Test />
  </React.StrictMode>,
);
