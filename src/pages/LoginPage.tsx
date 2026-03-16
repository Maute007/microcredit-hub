import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { systemApi, type ApiSystemSettings } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
  });

  const vendorName = "MAKIRA";
  const brandName = systemSettings?.name || vendorName;
  const primaryColor = systemSettings?.primary_color || "#0f766e";
  const tagline = systemSettings?.tagline || "Gestão moderna de microcrédito.";
  const loginDescription =
    systemSettings?.login_description ||
    "Organize clientes, empréstimos, pagamentos, recursos humanos e contabilidade numa única plataforma. Acompanhe a carteira, fluxo de caixa e risco em tempo real.";
  const loginBannerColor = systemSettings?.login_banner_color?.trim() || primaryColor;
  const loginCardColor = systemSettings?.login_card_color || "#ffffff";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast({ title: "Erro", description: "Preencha utilizador e palavra-passe.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      toast({ title: "Sucesso", description: "Sessão iniciada." });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Credenciais inválidas.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
      <div className="w-full max-w-4xl rounded-2xl border bg-card shadow-lg overflow-hidden grid md:grid-cols-2">
        {/* Lado esquerdo: imagem + descrição */}
        <div
          className="relative hidden md:flex flex-col justify-between p-8 text-primary-foreground"
          style={{ background: `linear-gradient(135deg, ${loginBannerColor}, ${loginBannerColor}CC)` }}
        >
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80)",
              }}
            />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 text-xs font-medium mb-4">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/15">
                {systemSettings?.logo_url ? (
                  <img
                    src={systemSettings.logo_url}
                    alt={brandName}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <Building2 className="h-3 w-3" />
                )}
              </span>
              {brandName}
            </div>
            <h1 className="text-2xl font-bold leading-snug mb-3">
              {tagline}
            </h1>
            <p className="text-sm text-primary-foreground/90 leading-relaxed">
              {loginDescription}
            </p>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-black/15 px-3 py-3">
              <p className="font-semibold mb-1">Clientes & Empréstimos</p>
              <p className="text-primary-foreground/85">
                Registo de clientes, simulações e aprovação rápida de crédito.
              </p>
            </div>
            <div className="rounded-xl bg-black/15 px-3 py-3">
              <p className="font-semibold mb-1">Pagamentos & Alertas</p>
              <p className="text-primary-foreground/85">
                Controle de cobranças, atrasos e recebimentos num só ecrã.
              </p>
            </div>
            <div className="rounded-xl bg-black/15 px-3 py-3">
              <p className="font-semibold mb-1">Recursos Humanos</p>
              <p className="text-primary-foreground/85">
                Gestão de equipa, férias, presenças e salários.
              </p>
            </div>
            <div className="rounded-xl bg-black/15 px-3 py-3">
              <p className="font-semibold mb-1">Relatórios</p>
              <p className="text-primary-foreground/85">
                Indicadores de desempenho e relatórios financeiros claros.
              </p>
            </div>
          </div>
        </div>

        {/* Lado direito: formulário */}
        <div
          className="p-6 sm:p-8 flex flex-col justify-center"
          style={{ backgroundColor: loginCardColor }}
        >
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                {systemSettings?.logo_url ? (
                  <img
                    src={systemSettings.logo_url}
                    alt={brandName}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold">{brandName}</h1>
                <p className="text-xs text-muted-foreground">
                  Aceda ao painel de gestão de microcrédito.
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Iniciar sessão
              </p>
              <h2 className="text-xl font-semibold mt-1">Bem-vindo de volta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Introduza as suas credenciais para continuar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Utilizador ou e-mail</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="nome ou email@exemplo.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "A iniciar..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
            Este sistema é destinado à equipa interna de microcrédito. Caso tenha
            dúvidas sobre o acesso, contacte o administrador do sistema.
          </p>

          <div className="mt-5 border-t pt-3 space-y-1">
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="mt-[2px] h-3.5 w-3.5 text-muted-foreground/80" />
              <p className="leading-relaxed">
                Suporte técnico e evolutivo assegurado pela MAUTE360. Para contacto profissional,
                utilize{" "}
                <a href="mailto:carlxyzsmaute@gmail.com" className="underline hover:text-foreground/80">
                  carlxyzsmaute@gmail.com
                </a>{" "}
                /{" "}
                <a href="mailto:maute9328@gmail.com" className="underline hover:text-foreground/80">
                  maute9328@gmail.com
                </a>{" "}
                ou{" "}
                <a href="tel:+258865105545" className="underline hover:text-foreground/80">
                  +258&nbsp;86&nbsp;510&nbsp;5545
                </a>
                .
              </p>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
              Nome comercial, logótipo e cores do sistema podem ser ajustados para cada cliente,
              preservando a infraestrutura e manutenção sob responsabilidade da MAUTE360.
            </p>
            {brandName !== vendorName && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Plataforma base: <span className="font-semibold">{vendorName}</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
