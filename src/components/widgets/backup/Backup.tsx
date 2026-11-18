import { useStore } from "@nanostores/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { IconDownload } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import type { BackupProps } from "./types";

const description = "Скачайте все записи, категории и цели в файл JSON. Перед выгрузкой приложение отправит ожидающие изменения в общий профиль.";

function BackupContent({ di }: BackupProps) {
  const authState = useStore(di.$authState);
  const connection = useStore(di.$connection);
  const { syncing } = useStore(di.syncEngine.$sync);
  const exportBackup = useMutation({ mutationFn: di.syncEngine.exportBackup });
  const online = authState === "authenticated" && connection === "online";
  const error = exportBackup.error ? exportBackup.error.message || "Не удалось сохранить копию." : "";

  return (
    <section data-sk="backup">
      <SectionHeading title="Резервная копия" />
      <Card className="gap-4 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <Button size="lg" className="w-full" disabled={!online || syncing || exportBackup.isPending} onClick={() => exportBackup.mutate()}>
          <IconDownload />{exportBackup.isPending ? "Готовим копию…" : "Скачать резервную копию"}
        </Button>
        {!online && <p className="text-[13px] leading-relaxed text-muted-foreground">Для выгрузки нужно подключение к сети.</p>}
        <FormError message={error} />
      </Card>
    </section>
  );
}

/** Download of the JSON backup of the shared profile. */
export function Backup({ di, skeleton = false }: BackupProps) {
  return (
    <SkeletonSwap loading={skeleton} skeleton={() => (
      <section data-sk="backup" aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Резервная копия" />} />
        <Card className="gap-4 p-5">
          <p className="text-sm leading-relaxed"><SkeletonText sample={description} /></p>
          <Skeleton className="h-12" />
        </Card>
      </section>
    )}>
      <BackupContent di={di} />
    </SkeletonSwap>
  );
}
