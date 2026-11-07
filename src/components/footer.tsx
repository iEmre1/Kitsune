import React from "react";
import { DiscordLogoIcon, InstagramLogoIcon,  } from "@radix-ui/react-icons";
import Image from "next/image";

const Footer = () => {
  return (
    <footer className="w-full bg-base-300 shadow-xl p-5 flex flex-col items-center space-y-5">
      <div className="flex space-x-5 items-center">
        <a href="https://discord.gg/wDK4zSuV3x" target="_blank">
            <DiscordLogoIcon suppressHydrationWarning width="25" height="25" />
        </a>
        <a href="https://animke.com" target="_blank">
            <InstagramLogoIcon suppressHydrationWarning width="25" height="25" />
        </a>
      </div>
      <p className="text-sm text-gray-300">
        Animke sunucuda herhangi bir dosya depolamaz; yalnızca üçüncü taraf
        servislerde barındırılan medyalara bağlantı verir.
      </p>
      <p className="text-sm text-gray-300">&copy; Animke</p>
    </footer>
  );
};

export default Footer;
