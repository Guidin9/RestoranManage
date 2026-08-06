/* İkon boyut ölçeği.

   Ayrı dosyada, çünkü icons.jsx yalnızca bileşen export etmeli — bir nesne
   sabiti oradan çıkarsa fast refresh bozuluyor (oxlint
   react/only-export-components; allowConstantExport nesneleri kapsamaz).

   Çağrı yerlerinde serbest sayı yerine bu basamakları kullan; eskiden
   ölçek diye bir şey yoktu, 14 farklı boyut dolaşıyordu. */
export const ICON = { xs: 14, sm: 16, md: 18, lg: 22, xl: 28 };
