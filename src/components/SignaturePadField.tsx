import { useEffect, useMemo, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SignatureKind = "signature" | "rubrica";

function storageKey(kind: SignatureKind) {
  return `signature-template-v1:${kind}`;
}

type TypedFont = {
  id: string;
  label: string;
  css: string;
};

const TYPED_FONTS: TypedFont[] = [
  { id: "great-vibes", label: "Great Vibes (manuscrito)", css: "\"Great Vibes\", cursive" },
  { id: "alex-brush", label: "Alex Brush (assinatura premium)", css: "\"Alex Brush\", cursive" },
  { id: "mr-dafoe", label: "Mr Dafoe (rubrica forte)", css: "\"Mr Dafoe\", cursive" },
  { id: "parisienne", label: "Parisienne (elegante)", css: "\"Parisienne\", cursive" },
  { id: "sacramento", label: "Sacramento (simples e real)", css: "\"Sacramento\", cursive" },
  { id: "yellowtail", label: "Yellowtail (compacta)", css: "\"Yellowtail\", cursive" },
  { id: "satisfy", label: "Satisfy (natural)", css: "\"Satisfy\", cursive" },
  { id: "dancing", label: "Dancing Script", css: "\"Dancing Script\", cursive" },
  { id: "allura", label: "Allura", css: "\"Allura\", cursive" },
  { id: "pacifico", label: "Pacifico", css: "\"Pacifico\", cursive" },
  { id: "handlee", label: "Handlee (mais casual)", css: "\"Handlee\", cursive" },
];

function dataUrlToImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function SignaturePadField({
  kind,
  value,
  onChange,
  height = 150,
  helpText,
}: {
  kind: SignatureKind;
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  helpText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [typedFont, setTypedFont] = useState<string>(TYPED_FONTS[0]?.id ?? "great-vibes");
  const [typedInk, setTypedInk] = useState<"black" | "blue">("black");
  const [typedSize, setTypedSize] = useState<number>(kind === "rubrica" ? 46 : 60);
  const [typedSlant, setTypedSlant] = useState<number>(-10);
  const [drawInk, setDrawInk] = useState<"black" | "blue">("black");
  const [drawStroke, setDrawStroke] = useState<"thin" | "normal" | "bold">(kind === "rubrica" ? "thin" : "normal");

  const templateKey = useMemo(() => storageKey(kind), [kind]);

  const renderTypedToCanvas = (name: string, fontId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));

    // background branco
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const fontCss = TYPED_FONTS.find((f) => f.id === fontId)?.css ?? "\"Great Vibes\", cursive";
    const ink = typedInk === "blue" ? "rgba(30, 64, 175, 0.92)" : "rgba(15, 23, 42, 0.92)";
    ctx.save();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(28, Math.min(96, typedSize))}px ${fontCss}`;
    const slant = Math.max(-25, Math.min(25, typedSlant));
    // Transform leve para dar sensação de manuscrito
    ctx.transform(1, 0, Math.tan((slant * Math.PI) / 180), 1, 0, 0);
    ctx.fillText(name, w / 2, h / 2 + 6);
    ctx.restore();

    // linha discreta (estética de assinatura)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.78);
    ctx.lineTo(w * 0.78, h * 0.78);
    ctx.stroke();
  };

  const resize = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Recriar pad (ele depende do canvas size)
    const stroke = drawStroke === "thin"
      ? { min: 0.7, max: 1.8 }
      : drawStroke === "bold"
        ? { min: 1.6, max: 3.6 }
        : { min: 1.1, max: 2.7 };
    const padInk = drawInk === "blue" ? "rgba(30, 64, 175, 0.92)" : "rgba(15, 23, 42, 0.92)";
    const pad = new SignaturePad(canvas, {
      minWidth: kind === "rubrica" ? stroke.min : Math.max(0.9, stroke.min),
      maxWidth: kind === "rubrica" ? stroke.max : Math.max(2.2, stroke.max),
      penColor: padInk,
      backgroundColor: "rgba(255,255,255,1)",
      throttle: 12,
      velocityFilterWeight: 0.7,
    });
    padRef.current = pad;

    if (mode === "type" && typedName.trim()) {
      renderTypedToCanvas(typedName.trim(), typedFont);
      setIsEmpty(false);
      return;
    }

    // Se já existe um value, desenhar novamente
    if (value) {
      try {
        const img = await dataUrlToImage(value);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        setIsEmpty(false);
      } catch {
        // ignore
      }
    } else {
      setIsEmpty(true);
    }
  };

  useEffect(() => {
    void resize();
    const onResize = () => void resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, mode, typedFont, typedInk, typedSize, typedSlant, drawInk, drawStroke]);

  useEffect(() => {
    if (mode !== "type") return;
    const name = typedName.trim();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));

    if (!name) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      setIsEmpty(true);
      return;
    }

    renderTypedToCanvas(name, typedFont);
    setIsEmpty(false);
    // Nota: não chamamos onChange aqui para não “guardar” a cada tecla.
  }, [mode, typedName, typedFont, typedInk, typedSize, typedSlant]);

  useEffect(() => {
    // Se value vem de fora (ex.: aplicar template), desenhar no canvas
    if (!value) {
      setIsEmpty(true);
      padRef.current?.clear();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));
    void (async () => {
      try {
        const img = await dataUrlToImage(value);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        setIsEmpty(false);
      } catch {
        // ignore
      }
    })();
  }, [value]);

  const clear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
    onChange("");
  };

  const saveToValue = () => {
    const pad = padRef.current;
    if (mode === "type") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!typedName.trim()) {
        onChange("");
        setIsEmpty(true);
        return;
      }
      renderTypedToCanvas(typedName.trim(), typedFont);
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
      setIsEmpty(false);
      return;
    }

    if (!pad || pad.isEmpty()) {
      onChange("");
      setIsEmpty(true);
      return;
    }
    const dataUrl = pad.toDataURL("image/png");
    onChange(dataUrl);
    setIsEmpty(false);
  };

  const saveAsTemplate = () => {
    saveToValue();
    const pad = padRef.current;
    const canvas = canvasRef.current;
    const dataUrl = mode === "type"
      ? (canvas ? canvas.toDataURL("image/png") : "")
      : (pad && !pad.isEmpty() ? pad.toDataURL("image/png") : "");
    if (!dataUrl) return;
    try {
      window.localStorage.setItem(templateKey, dataUrl);
    } catch {
      // ignore
    }
  };

  const applyTemplate = () => {
    try {
      const dataUrl = window.localStorage.getItem(templateKey) || "";
      if (!dataUrl) return;
      onChange(dataUrl);
      setIsEmpty(false);
    } catch {
      // ignore
    }
  };

  const deleteTemplate = () => {
    try {
      window.localStorage.removeItem(templateKey);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold text-sm">
            {kind === "rubrica" ? "Rubrica" : "Assinatura"}
          </p>
          <p className="text-xs text-muted-foreground">
            {helpText || "Desenhe com o rato ou dedo. Depois guarde para reutilizar."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === "draw" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMode("draw")}
          >
            Desenhar
          </Button>
          <Button
            type="button"
            variant={mode === "type" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMode("type")}
          >
            Escrever nome
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={applyTemplate}>
            Usar minha {kind === "rubrica" ? "rubrica" : "assinatura"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={deleteTemplate}>
            Apagar modelo
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {mode === "type" && (
          <div className="p-3 border-b bg-muted/20 grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <Label>{kind === "rubrica" ? "Texto da rubrica" : "Nome para assinatura"}</Label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={kind === "rubrica" ? "Ex.: ADT" : "Ex.: Antónia Diogo Tinga"}
              />
            </div>
            <div>
              <Label>Estilo</Label>
              <Select value={typedFont} onValueChange={setTypedFont}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPED_FONTS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tinta</Label>
              <Select value={typedInk} onValueChange={(v) => setTypedInk(v as "black" | "blue")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="black">Preto</SelectItem>
                  <SelectItem value="blue">Azul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tamanho</Label>
              <Input
                type="number"
                value={typedSize}
                min={28}
                max={96}
                onChange={(e) => setTypedSize(Math.max(28, Math.min(96, Number(e.target.value) || 0)))}
              />
            </div>
            <div>
              <Label>Inclinação</Label>
              <Input
                type="number"
                value={typedSlant}
                min={-25}
                max={25}
                onChange={(e) => setTypedSlant(Math.max(-25, Math.min(25, Number(e.target.value) || 0)))}
              />
            </div>
          </div>
        )}
        {mode === "draw" && (
          <div className="p-3 border-b bg-muted/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Tinta</Label>
              <Select value={drawInk} onValueChange={(v) => setDrawInk(v as "black" | "blue")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="black">Preto</SelectItem>
                  <SelectItem value="blue">Azul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Traço</Label>
              <Select value={drawStroke} onValueChange={(v) => setDrawStroke(v as "thin" | "normal" | "bold")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thin">Fino</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Marcante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground flex items-end">
              Dica: se usar touchpad, “Escrever nome” dá um efeito mais real.
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height }}
          onPointerUp={saveToValue}
          onPointerCancel={saveToValue}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Limpar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={saveToValue} disabled={isEmpty}>
          Guardar no contrato
        </Button>
        <Button type="button" size="sm" onClick={saveAsTemplate} disabled={isEmpty}>
          Guardar como meu modelo
        </Button>
      </div>
    </div>
  );
}

