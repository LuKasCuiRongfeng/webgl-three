import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Map from "./map/tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Map />
  </React.StrictMode>,
);
