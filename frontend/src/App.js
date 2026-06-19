import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

function App() {
  return (
    <div className="App min-h-screen bg-[#0B0A09] text-[#F3F2F0]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaign/:campaignId" element={<Editor />} />
          <Route path="/campaign/:campaignId/map/:mapId" element={<Editor />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}

export default App;
