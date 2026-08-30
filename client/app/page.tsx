"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Status = "loading" | "ok" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .get("/")
      .then((res) => {
        setStatus("ok");
        setMessage(res.data.message);
      })
      .catch(() => {
        setStatus("error");
        setMessage("Could not reach the backend");
      });
  }, []);

  const color =
    status === "ok" ? "text-green-400" : status === "error" ? "text-red-400" : "text-gray-400";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">CodeShare</h1>
        <p className={color}>
          {status === "loading" ? "Checking backend…" : message}
        </p>
      </div>
    </main>
  );
}