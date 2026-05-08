import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { loansApi } from "@/lib/api";
import { formatDate } from "@/data/mockData";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";

export default function VerifyContractPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") || params.get("proof") || "";
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<null | {
    id: string;
    loan: number;
    contract_sha256: string;
    created_at: string;
  }>(null);

  const hint = useMemo(() => {
    if (!result) return "";
    return `Empréstimo #${result.loan} • Emitido em ${formatDate(result.created_at)} • HASH ${result.contract_sha256.slice(0, 16)}…${result.contract_sha256.slice(-8)}`;
  }, [result]);

  const verify = async () => {
    const key = q.trim();
    if (!key) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await loansApi.lookupContractProof(key);
      const first = res.results?.[0];
      if (!first) {
        setError("Nenhuma prova encontrada para este ID/HASH.");
        return;
      }
      setResult({
        id: first.id,
        loan: first.loan,
        contract_sha256: first.contract_sha256,
        created_at: first.created_at,
      });
      setParams({ q: key });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificar contrato"
        description="Cole o Proof ID ou HASH para confirmar que o documento foi emitido pelo sistema."
      />

      {error && <QueryErrorAlert message={error} onRetry={verify} />}

      <div className="rounded-2xl border bg-card p-6 space-y-3">
        <div>
          <Label>Proof ID / HASH</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: 2f5e... (UUID) ou prefixo do hash..."
          />
        </div>
        <Button onClick={verify} disabled={loading || !q.trim()}>
          {loading ? "A verificar..." : "Verificar"}
        </Button>
        {result && (
          <div className="mt-4 rounded-xl border bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-semibold">Prova encontrada</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
            <div className="text-xs">
              <p className="text-muted-foreground">Proof ID</p>
              <p className="font-mono break-all">{result.id}</p>
              <p className="text-muted-foreground mt-2">HASH completo</p>
              <p className="font-mono break-all">{result.contract_sha256}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

