"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { messaging } from "@/firebase";
import { useSetRecoilState } from "recoil";
import { accessTokenState, refreshTokenState, userIdState } from "@/store/auth";
import { setCookie } from "cookies-next";

export default function GoogleAuth2Redirect() {
  const [code, setCode] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const setAccessToken = useSetRecoilState(accessTokenState);
  const setRefreshToken = useSetRecoilState(refreshTokenState);
  const setUserId = useSetRecoilState(userIdState);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URL(window.location.href);
      const receivedCode = urlParams.searchParams.get("code");
      if (receivedCode) {
        console.log("receivedCode", receivedCode);
        setCode(receivedCode);
      }

      const fetchFcmToken = async () => {
        try {
          const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY });
          console.log("FCM 토큰 가져옴:", token);
          setFcmToken(token);
        } catch (error) {
          console.error("FCM 토큰을 가져오는 중 오류 발생:", error);
        }
      };

      fetchFcmToken();
    }
  }, []);

  useEffect(() => {
    console.log("코드 설정:", code);
    console.log("fcmToken 설정:", fcmToken);
    if (code && fcmToken) {
      const googleLogin = async () => {
        try {
          const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
          const res = await fetch(`${BASE_URL}/user/google/login?code=${code}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.status === 200) {
            console.log("로그인 성공");
            const data = await res.json();

            setCookie("accessToken", data.accessToken, { secure: true });
            setAccessToken(data.accessToken);
            setRefreshToken(data.refreshToken);
            setUserId(data.userId);

            if (fcmToken) {
              console.log("googleLogin 안의 fcmToken:", fcmToken);
              try {
                const tokenRes = await fetch(`${BASE_URL}/user/fcm/token`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${data.accessToken}`,
                  },
                  body: JSON.stringify({ fcmToken }),
                });

                if (tokenRes.status === 200 || 201) {
                  console.log("FCM 토큰 전송 성공");
                  router.replace("/my?tab=videos");
                } else {
                  console.error("FCM 토큰 전송 실패:", tokenRes.status);
                }
              } catch (tokenError) {
                console.error("FCM 토큰 전송 중 오류 발생:", tokenError);
              }
            }
          } else {
            console.error("예상치 못한 응답 상태:", res.status);
          }
        } catch (error) {
          console.log(error);
        }
      };

      googleLogin();
    }
  }, [code, fcmToken, router, setAccessToken, setRefreshToken, setUserId]);

  return null;
}
