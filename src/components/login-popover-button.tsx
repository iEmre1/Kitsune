import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import Button from "./common/custom-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import DiscordIcon from "@/icons/discord";
import { pb } from "@/lib/pocketbase";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

type FormData = {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
};

const fieldNames: Record<string, string> = {
  username: "Kullanıcı adı",
  email: "E-posta",
  password: "Şifre",
  passwordConfirm: "Şifre tekrarı",
};

// Alana özel açıklayıcı hata mesajları: fieldErrors[alan][hata_kodu]
const fieldErrors: Record<string, Record<string, string>> = {
  username: {
    validation_not_unique:
      "Bu kullanıcı adı zaten alınmış. Lütfen farklı bir kullanıcı adı seçin.",
    validation_required: "Kullanıcı adı boş bırakılamaz.",
    validation_min_text_constraint:
      "Kullanıcı adı çok kısa. En az 3 karakter olmalı.",
    validation_max_text_constraint:
      "Kullanıcı adı çok uzun. Daha kısa bir kullanıcı adı seçin.",
    validation_length_out_of_range:
      "Kullanıcı adı uzunluğu geçersiz. 3 ile 150 karakter arasında olmalı.",
    validation_invalid_username:
      "Kullanıcı adı geçersiz karakterler içeriyor. Sadece harf, rakam ve alt çizgi kullanın.",
    validation_match_invalid:
      "Kullanıcı adı geçersiz karakterler içeriyor. Sadece harf, rakam ve alt çizgi kullanın.",
  },
  email: {
    validation_not_unique:
      "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin ya da farklı bir e-posta kullanın.",
    validation_required: "E-posta adresi boş bırakılamaz.",
    validation_is_email:
      "Geçerli bir e-posta adresi girin. Örnek: isim@ornek.com",
    validation_invalid_email:
      "Geçerli bir e-posta adresi girin. Örnek: isim@ornek.com",
    validation_invalid_value:
      "Bu e-posta adresi kabul edilmiyor. Lütfen başka bir e-posta deneyin.",
  },
  password: {
    validation_required: "Şifre boş bırakılamaz.",
    validation_min_text_constraint:
      "Şifre çok kısa. En az 8 karakter olmalı.",
    validation_length_out_of_range:
      "Şifre uzunluğu geçersiz. En az 8 karakter olmalı.",
    validation_max_text_constraint:
      "Şifre çok uzun. Daha kısa bir şifre seçin.",
  },
  passwordConfirm: {
    validation_required: "Şifre tekrarı boş bırakılamaz.",
    validation_values_mismatch:
      "Şifreler birbiriyle eşleşmiyor. İki alana aynı şifreyi girdiğinizden emin olun.",
  },
};

// Alana özel mesaj bulunamazsa kullanılan genel mesajlar
const genericErrors: Record<string, string> = {
  validation_not_unique: "zaten kullanımda. Lütfen farklı bir değer girin.",
  validation_required: "boş bırakılamaz.",
  validation_invalid_email: "geçerli bir e-posta adresi değil.",
  validation_is_email: "geçerli bir e-posta adresi değil.",
  validation_values_mismatch: "değerler eşleşmiyor.",
  validation_min_text_constraint: "çok kısa.",
  validation_max_text_constraint: "çok uzun.",
  validation_length_out_of_range: "uzunluğu geçersiz.",
};

function getSignupErrorMessage(field: string, code?: string): string {
  if (code && fieldErrors[field]?.[code]) {
    return fieldErrors[field][code];
  }
  const name = fieldNames[field] ?? field;
  if (code && genericErrors[code]) {
    return `${name} ${genericErrors[code]}`;
  }
  return `${name} alanında geçersiz bir değer var. Lütfen kontrol edip tekrar deneyin.`;
}

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
        toast.error(
          "E-posta/kullanıcı adı ve şifre alanlarının ikisini de doldurmanız gerekiyor.",
          { style: { background: "red" } }
        );
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
    } catch (e: any) {
      console.error("Login error:", e);

      if (e?.status === 0) {
        toast.error(
          "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
          { style: { background: "red" }, duration: 6000 }
        );
      } else if (e?.status === 400) {
        toast.error(
          "E-posta/kullanıcı adı veya şifre hatalı. Bilgilerinizi kontrol edin. Yeni kayıt olduysanız e-postanıza gelen doğrulama bağlantısına tıklayarak hesabınızı doğrulamış olmanız gerekir.",
          { style: { background: "red" }, duration: 8000 }
        );
      } else {
        toast.error("Giriş yapılamadı. Lütfen biraz sonra tekrar deneyin.", {
          style: { background: "red" },
        });
      }
    }
  };

  const signupWithEmail = async () => {
    if (
      formData.username === "" ||
      formData.password === "" ||
      formData.email === "" ||
      formData.confirm_password === ""
    ) {
      toast.error("Kayıt olmak için tüm alanları doldurmanız gerekiyor.", {
        style: { background: "red" },
      });
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error(
        "Şifreler birbiriyle eşleşmiyor. İki alana aynı şifreyi girdiğinizden emin olun.",
        { style: { background: "red" }, duration: 6000 }
      );
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Şifre çok kısa. En az 8 karakter olmalı.", {
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
        try {
          await pb.collection("users").requestVerification(formData.email);
          toast.success(
            "Hesabınız oluşturuldu! E-postanıza bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayıp hesabınızı doğruladıktan sonra giriş yapabilirsiniz. Gelen kutusunda göremezseniz spam klasörüne de bakın.",
            { style: { background: "green" }, duration: 10000 }
          );
        } catch (err) {
          console.error("Verification email error:", err);
          toast.success(
            "Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi. Lütfen giriş yapmayı deneyin.",
            { style: { background: "green" }, duration: 8000 }
          );
        }
        clearForm();
        setTabValue("login");
      }
    } catch (e: any) {
      console.error("Signup error:", e);

      if (e?.status === 0) {
        toast.error(
          "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
          { style: { background: "red" }, duration: 6000 }
        );
        return;
      }

      const data = e?.response?.data;
      if (data && Object.keys(data).length > 0) {
        for (const key in data) {
          toast.error(getSignupErrorMessage(key, data[key]?.code), {
            style: { background: "red" },
            duration: 7000,
          });
        }
      } else {
        toast.error(
          "Kayıt işlemi tamamlanamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.",
          { style: { background: "red" } }
        );
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
      await pb.collection("users").authWithOAuth2({
        provider: "discord",
      });

      if (pb.authStore.isValid && pb.authStore.record) {
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
    } catch (e: any) {
      console.error("Discord login error:", e);

      const data = e?.response?.data;
      if (data?.username?.code === "validation_not_unique") {
        toast.error(
          "Discord kullanıcı adınız sitede başka bir hesap tarafından kullanılıyor. Lütfen site yöneticisiyle iletişime geçin.",
          { style: { background: "red" }, duration: 8000 }
        );
      } else if (data?.email?.code === "validation_not_unique") {
        toast.error(
          "Discord hesabınızın e-posta adresiyle sitede zaten bir hesap var. Önce e-posta ve şifrenizle giriş yapmayı deneyin.",
          { style: { background: "red" }, duration: 8000 }
        );
      } else if (e?.status === 0) {
        toast.error(
          "Discord girişi tamamlanamadı. Açılan pencere kapatılmış ya da engellenmiş olabilir. Tarayıcınızın açılır pencere (pop-up) engelleyicisini kontrol edip tekrar deneyin.",
          { style: { background: "red" }, duration: 8000 }
        );
      } else {
        toast.error(
          "Discord ile giriş başarısız oldu. Lütfen tekrar deneyin. Sorun devam ederse e-posta ile giriş yapabilirsiniz.",
          { style: { background: "red" }, duration: 6000 }
        );
      }
    }
  };

  const forgotPassword = async () => {
    const email = formData.username.trim();

    if (!email.includes("@")) {
      toast.error(
        "Şifrenizi sıfırlamak için yukarıdaki alana e-posta adresinizi yazın, sonra tekrar deneyin.",
        { style: { background: "red" }, duration: 6000 }
      );
      return;
    }

    try {
      await pb.collection("users").requestPasswordReset(email);
      toast.success(
        "Bu e-posta adresiyle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.",
        { style: { background: "green" }, duration: 10000 }
      );
    } catch (e: any) {
      console.error("Password reset request error:", e);
      if (e?.status === 0) {
        toast.error(
          "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
          { style: { background: "red" }, duration: 6000 }
        );
      } else {
        toast.error(
          "Şifre sıfırlama isteği gönderilemedi. Lütfen biraz sonra tekrar deneyin.",
          { style: { background: "red" }, duration: 6000 }
        );
      }
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
            <button
              type="button"
              onClick={forgotPassword}
              className="text-xs text-primary hover:underline self-center"
            >
              Şifremi unuttum
            </button>
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
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export default LoginPopoverButton;