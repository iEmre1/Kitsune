import Image from "next/image";
import { ROUTES } from "@/constants/routes";
import { ButtonLink } from "@/components/common/button-link";
import ErrorImage from "@/assets/error.gif";

export default function NotFound() {
  return (
    <div className="w-[100dvw] h-[100dvh]">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col space-y-5 items-center justify-center">
        <Image
          src={ErrorImage.src}
          alt="error"
          width={300}
          height={300}
          className=""
        />
        <p className="font-bold text-2xl">Sayfa bulunamadı!</p>
        <div className="flex gap-3 items-center">
          <ButtonLink href={ROUTES.HOME}>Ana Sayfaya Dön</ButtonLink>
        </div>
      </div>
    </div>
  );
}
