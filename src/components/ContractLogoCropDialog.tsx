import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedPngBlob } from "@/lib/cropImage";
import { systemApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onUploaded: () => void;
};

export function ContractLogoCropDialog({ open, onOpenChange, imageSrc, onUploaded }: Props) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
    }
  }, [open]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setArea(croppedPixels);
  }, []);

  const apply = async () => {
    if (!imageSrc || !area) {
      toast({ title: "Ajuste o recorte", description: "Mova o enquadramento antes de aplicar.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const blob = await getCroppedPngBlob(imageSrc, area, 512);
      const file = new File([blob], "contract-logo.png", { type: "image/png" });
      await systemApi.uploadContractLogo(file);
      toast({ title: "Logo guardado", description: "O logo do contrato foi actualizado." });
      onUploaded();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({
        title: "Erro ao enviar",
        description: e instanceof Error ? e.message : "Não foi possível guardar o logo.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recortar logo do contrato</DialogTitle>
        </DialogHeader>
        {imageSrc ? (
          <div className="space-y-3">
            <div className="relative h-64 w-full overflow-hidden rounded-lg border bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Zoom</p>
              <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={(v) => setZoom(v[0] ?? 1)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma imagem seleccionada.</p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={busy || !imageSrc}>
            {busy ? "A enviar..." : "Aplicar e guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
