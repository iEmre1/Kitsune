import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import Button from "./common/custom-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import DiscordIcon from "@/icons/discord";
import GoogleIcon from "@/icons/google";
import { pb } from "@/lib/pocketbase";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

type FormData = {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
};

function LoginPopoverButton() {
  const auth = useAuthStore();
  const [formData, setFormData] = useState<FormData>({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [tabValue, setTabValue] = useState<"login" | "signup">("login");

  const loginWithEmail = async () => {
    try {
      if (formData.username === "" || formData.password === "") {
        toast.error("Lütfen tüm alanları doldurun", {
          style: { background: "red" },
        });
        return;
      }

      await pb
        .collection("users")
        .authWithPassword(formData.username, formData.password);

      if (pb.authStore.isValid && pb.authStore.record) {
        toast.success("Giriş başarılı", { style: { background: "green" } });
        clearForm();
        auth.setAuth({
          id: pb.authStore.record.id,
          email: pb.authStore.record.email,
          username: pb.authStore.record.username,
          avatar: pb.authStore.record.avatar,
          collectionId: pb.authStore.record.collectionId,
          collectionName: pb.authStore.record.collectionName,
          autoSkip: pb.authStore.record.autoSkip,
          created: pb.authStore.record.created,
        });
      }
    } catch (e) {
      console.error("Login error:", e);
      toast.error("Geçersiz kullanıcı adı veya şifre", {
        style: { background: "red" },
      });
    }
  };

  const signupWithEmail = async () => {
    if (
      formData.username === "" ||
      formData.password === "" ||
      formData.email === "" ||
      formData.confirm_password === ""
    ) {
      toast.error("Lütfen tüm alanları doldurun", {
        style: { background: "red" },
      });
      return;
    }

    try {
      const user = await pb.collection("users").create({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.confirm_password,
      });

      if (user) {
        toast.success("Hesap başarıyla oluşturuldu. Lütfen giriş yapın.", {
          style: { background: "green" },
        });
        clearForm();
        setTabValue("login");
      }
    } catch (e: any) {
      if (e.response?.data) {
        for (const key in e.response?.data) {
          toast.error(`${key}: ${e.response.data[key].message}`, {
            style: { background: "red" },
          });
        }
      } else {
        toast.error("Kayıt başarısız oldu. Lütfen tekrar deneyin.", {
          style: { background: "red" },
        });
      }
    }
  };

  const clearForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      confirm_password: "",
    });
  };

  const loginWithDiscord = async () => {
    try {
      const res = await pb.collection("users").authWithOAuth2({
        provider: "discord",
      });

      if (pb.authStore.isValid && pb.authStore.record) {
        if (res.meta?.username && pb.authStore.record.username !== res.meta.username) {
          try {
            await pb.collection("users").update(pb.authStore.record.id, {
              username: res.meta.username,
            });
          } catch (e) {
            // ignore if username update fails
          }
        }

        toast.success("Giriş başarılı", { style: { background: "green" } });
        auth.setAuth({
          id: pb.authStore.record.id,
          email: pb.authStore.record.email,
          username: pb.authStore.record.username,
          avatar: pb.authStore.record.avatar,
          collectionId: pb.authStore.record.collectionId,
          collectionName: pb.authStore.record.collectionName,
          autoSkip: pb.authStore.record.autoSkip,
          created: pb.authStore.record.created,
        });
      }
    } catch (e) {
      console.error("Discord login error:", e);
      toast.error("Discord ile giriş başarısız oldu", {
        style: { background: "red" },
      });
    }
  };

  const loginWithGoogle = async () => {
    try {
      const res = await pb.collection("users").authWithOAuth2({
        provider: "google",
      });

      if (pb.authStore.isValid && pb.authStore.record) {
        if (res.meta?.username && pb.authStore.record.username !== res.meta.username) {
          try {
            await pb.collection("users").update(pb.authStore.record.id, {
              username: res.meta.username,
            });
          } catch (e) {
            // ignore if username update fails
          }
        }

        toast.success("Giriş başarılı", { style: { background: "green" } });
        auth.setAuth({
          id: pb.authStore.record.id,
          email: pb.authStore.record.email,
          username: pb.authStore.record.username,
          avatar: pb.authStore.record.avatar,
          collectionId: pb.authStore.record.collectionId,
          collectionName: pb.authStore.record.collectionName,
          autoSkip: pb.authStore.record.autoSkip,
          created: pb.authStore.record.created,
        });
      }
    } catch (e) {
      console.error("Google login error:", e);
      toast.error("Google ile giriş başarısız oldu", {
        style: { background: "red" },
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="bg-white text-md text-black hover:bg-gray-200 hover:text-black transition-all duration-300"
        >
          Giriş Yap
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        className="z-[110] bg-slate-950/75 backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] rounded-xl w-[300px] mt-4 mr-4 p-4"
      >
        <Tabs
          defaultValue={tabValue}
          value={tabValue}
          onValueChange={(value) => setTabValue(value as "login" | "signup")}
        >
          <TabsList>
            <TabsTrigger onClick={clearForm} value="login">
              Giriş Yap
            </TabsTrigger>
            <TabsTrigger onClick={clearForm} value="signup">
              Kayıt Ol
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="flex flex-col gap-2">
            <div className="mt-2">
              <p className="text-gray-300 text-xs">E-posta veya Kullanıcı Adı:</p>
              <Input
                required
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                type="text"
                value={formData.username}
                placeholder="E-posta/kullanıcı adınızı girin"
              />
            </div>
            <div>
              <p className="text-gray-300 text-xs">Şifre:</p>
              <Input
                required
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Şifrenizi girin"
              />
            </div>
            <Button
              variant="default"
              className="w-full text-xs"
              size="sm"
              type="submit"
              onClick={loginWithEmail}
            >
              Giriş Yap
            </Button>
            <hr className="text-white text-xs text-center" />
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-800 text-white w-full text-xs"
              size="sm"
              onClick={loginWithDiscord}
            >
              <DiscordIcon className="mr-2" />
              Discord ile Giriş Yap
            </Button>
            <Button
              variant="default"
              className="bg-white hover:bg-gray-200 text-black w-full text-xs"
              size="sm"
              onClick={loginWithGoogle}
            >
              <GoogleIcon className="mr-2" />
              Google ile Giriş Yap
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="flex flex-col gap-2">
            <div>
              <p className="text-gray-300 text-xs">Kullanıcı Adı:</p>
              <Input
                required
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                type="text"
                placeholder="Kullanıcı adınızı girin"
              />
            </div>
            <div>
              <p className="text-gray-300 text-xs">E-posta:</p>
              <Input
                required
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                type="email"
                placeholder="E-postanızı girin"
              />
            </div>
            <div>
              <p className="text-gray-300 text-xs">Şifre:</p>
              <Input
                required
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                type="password"
                placeholder="Şifrenizi girin"
              />
            </div>
            <div>
              <p className="text-gray-300 text-xs">Şifre Tekrarı:</p>
              <Input
                required
                onChange={(e) =>
                  setFormData({ ...formData, confirm_password: e.target.value })
                }
                type="password"
                placeholder="Şifrenizi tekrar girin"
              />
            </div>
            <Button
              variant="default"
              className="w-full text-xs"
              size="sm"
              type="submit"
              onClick={signupWithEmail}
            >
              Kayıt Ol
            </Button>
            <hr className="text-white text-xs text-center" />
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-800 text-white w-full text-xs"
              size="sm"
              onClick={loginWithDiscord}
            >
              <DiscordIcon className="mr-2" />
              Discord ile Kayıt Ol
            </Button>
            <Button
              variant="default"
              className="bg-white hover:bg-gray-200 text-black w-full text-xs"
              size="sm"
              onClick={loginWithGoogle}
            >
              <GoogleIcon className="mr-2" />
              Google ile Kayıt Ol
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export default LoginPopoverButton;
