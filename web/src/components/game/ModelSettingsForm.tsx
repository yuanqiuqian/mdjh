import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { redactApiKey, validateLlmConfig } from "@/services/llm";
import { useAppStore } from "@/store/useAppStore";
import type { LlmConfig } from "@/types/game";

const schema = z.object({
  endpoint: z
    .string()
    .min(1, "请输入 endpoint")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "endpoint 必须是完整 URL（http/https）"),
  modelId: z.string().min(1, "请输入 model_id"),
  apiKey: z.string().min(1, "请输入 api_key"),
  rememberOnDevice: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Provides the OpenAI-compatible model configuration form inside a modal.
 */
export function ModelSettingsForm() {
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const saveLlmConfig = useAppStore((state) => state.saveLlmConfig);
  const setValidation = useAppStore((state) => state.setValidation);
  const clearConfig = useAppStore((state) => state.clearConfig);
  const isOnline = useAppStore((state) => state.isOnline);
  const defaultValues = useMemo<FormValues>(
    () => ({
      endpoint: llmConfig?.endpoint ?? "",
      modelId: llmConfig?.modelId ?? "",
      apiKey: llmConfig?.apiKey ?? "",
      rememberOnDevice: llmConfig?.rememberOnDevice ?? true,
    }),
    [llmConfig],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  /**
   * Tests and persists the model configuration after a successful validation.
   */
  const submit = form.handleSubmit(async (values) => {
    setIsTesting(true);
    const result = await validateLlmConfig({
      endpoint: values.endpoint ?? "",
      modelId: values.modelId ?? "",
      apiKey: values.apiKey ?? "",
    });
    setIsTesting(false);
    setValidation({
      status: result.success ? "success" : "error",
      message: result.message,
      latencyMs: result.latencyMs,
    });
    if (!result.success) {
      return;
    }
    const next: LlmConfig = {
      endpoint: (values.endpoint ?? "").trim(),
      modelId: (values.modelId ?? "").trim(),
      apiKey: (values.apiKey ?? "").trim(),
      rememberOnDevice: Boolean(values.rememberOnDevice),
      lastValidatedAt: new Date().toISOString(),
    };
    await saveLlmConfig(next);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={submit} className="grid gap-4 rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="grid gap-1">
          <label className="text-xs text-stone-400">endpoint</label>
          <input
            {...form.register("endpoint")}
            placeholder="https://your-domain.com/v1 或 https://your-domain.com/v1/chat/completions"
            className={cn(
              "w-full rounded-[18px] border bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40",
              form.formState.errors.endpoint ? "border-rose-400/40" : "border-white/10",
            )}
          />
          {form.formState.errors.endpoint?.message ? (
            <p className="text-xs text-rose-300">{form.formState.errors.endpoint.message}</p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-stone-400">model_id</label>
          <input
            {...form.register("modelId")}
            placeholder="例如 gpt-4o-mini 或你服务端定义的模型名"
            className={cn(
              "w-full rounded-[18px] border bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40",
              form.formState.errors.modelId ? "border-rose-400/40" : "border-white/10",
            )}
          />
          {form.formState.errors.modelId?.message ? (
            <p className="text-xs text-rose-300">{form.formState.errors.modelId.message}</p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-stone-400">api_key</label>
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="text-[11px] text-stone-500 hover:text-stone-200"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
          <input
            {...form.register("apiKey")}
            type={showKey ? "text" : "password"}
            placeholder="仅用于向你的 endpoint 发请求，不会写入日志"
            autoComplete="off"
            className={cn(
              "w-full rounded-[18px] border bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40",
              form.formState.errors.apiKey ? "border-rose-400/40" : "border-white/10",
            )}
          />
          {form.formState.errors.apiKey?.message ? (
            <p className="text-xs text-rose-300">{form.formState.errors.apiKey.message}</p>
          ) : null}
        </div>

        <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-300"
            {...form.register("rememberOnDevice")}
          />
          <span>记住此设备（保存到本地 IndexedDB，可在游戏内“系统”里导出时选择是否包含 key）</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isTesting || !isOnline}
            className={cn(
              "rounded-[18px] px-4 py-2 text-sm transition",
              isTesting || !isOnline
                ? "bg-white/5 text-stone-500"
                : "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
            )}
          >
            {isTesting ? "测试中…" : "测试并保存"}
          </button>
          <button
            type="button"
            onClick={() => clearConfig()}
            className="rounded-[18px] bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
          >
            清除本机记忆
          </button>
        </div>

        {!isOnline ? (
          <p className="text-xs text-stone-500">当前离线，无法进行连接测试。</p>
        ) : null}
      </form>

      <div className="grid gap-4">
        <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
          <p className="text-sm text-stone-100">
            {validation.status === "success"
              ? "已通过"
              : validation.status === "error"
                ? "未通过"
                : "尚未测试"}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-400">{validation.message}</p>
          {typeof validation.latencyMs === "number" ? (
            <p className="mt-2 text-xs text-stone-500">耗时：{validation.latencyMs}ms</p>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/30 p-4 sm:p-5">
          <p className="text-sm text-stone-100">不要把 key 暴露出去</p>
          <div className="mt-3 space-y-3 text-xs leading-6 text-stone-400">
            <p>默认导出不包含 api_key；如确需迁移，可在导出时二次确认。</p>
            <p>界面仅显示脱敏后的 key：{llmConfig ? redactApiKey(llmConfig.apiKey) : "****"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
