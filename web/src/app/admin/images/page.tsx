import { DeleteNewsImageButton, NewsImageUpload } from "@/components/admin/forms";
import { NewsImageFrame } from "@/components/news-image";
import { Card, PageTitle, Section } from "@/components/section";
import { ALL_CATEGORIES } from "@/config/news-categories";
import { requireAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

/** Generic images per news category, shown with NPFL headlines and shares. */
export default async function AdminImagesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: images } = await supabase
    .from("news_images")
    .select("id,category,url,source")
    .order("created_at");

  return (
    <>
      <PageTitle sub="Three to five generic images per category. Headlines are sorted into a category by their words, and each story keeps the same image. Every image gets the site's navy and yellow tint.">
        Images
      </PageTitle>
      <Card className="mb-6 text-sm">
        <p className="font-medium">Rules for every image</p>
        <p className="mt-1 text-muted-foreground">
          No club crests, kits or club colours that identify a club, no real players&apos; faces, no
          stadium names, sponsor logos or betting imagery. Use your own images, an image generator
          whose terms allow commercial use, or free libraries such as Unsplash and Pexels. Note the
          source every time. PNG, WebP or JPEG, up to 1.5 MB, ideally 1200×800 or larger.
        </p>
      </Card>

      {ALL_CATEGORIES.map((c) => {
        const mine = (images ?? []).filter((i) => i.category === c.key);
        return (
          <Section key={c.key} title={`${c.label} (${mine.length})`}>
            <Card className="grid gap-3">
              <p className="text-sm text-muted-foreground">Ideas: {c.brief}</p>
              {mine.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {mine.map((img) => (
                    <li key={img.id} className="grid gap-1 text-xs">
                      <NewsImageFrame src={img.url} className="aspect-[3/2] rounded-lg" />
                      <span className="truncate text-muted-foreground" title={img.source}>
                        {img.source}
                      </span>
                      <DeleteNewsImageButton id={img.id} />
                    </li>
                  ))}
                </ul>
              )}
              <NewsImageUpload category={c.key} />
            </Card>
          </Section>
        );
      })}
    </>
  );
}
