'use client';
import {useEffect, useState} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/navigation/ThemeToggle';
import toast from 'react-hot-toast';
import {client} from "@/Graphql/client";
import {gql} from "@apollo/client";
import {SubmitHandler, useForm} from "react-hook-form";
import type { LoginFormValues, VerifyTokenResponse, LoginMutationResponse } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false); // fix 1: unified state name

  const logoSrc = theme === 'dark' ? '/images/dark_logo.png' : '/images/light_logo.png';

  const {
    register,
    handleSubmit,
    reset,
    formState: {errors},
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const getUser = () => {
      const token = localStorage.getItem("token");
      if (token) {
        const mutation = gql`
          mutation VerifyToken($token: String!) {
            VerifyToken(token: $token) {
              success
            }
          }
        `;

        setIsLoading(true);
        client.mutate<VerifyTokenResponse>({
          mutation,
          variables: { token },
          fetchPolicy: "no-cache",
        })
            .then((res) => {
              if (res.data?.VerifyToken.success) {
                document.cookie = `arno-auth=${token}; path=/; max-age=${6 * 3600}; SameSite=Lax`;
                router.push("/dashboard");
              } else {
                localStorage.clear();
              }
            })
            .catch((err) => {
              localStorage.clear();
              console.error(err);
            })
            .finally(() => {
              setIsLoading(false);
            });
      }
    };
    getUser();
  }, []);

  // fix 2: name matches what the form calls — passed via handleSubmit below
  const onSubmit: SubmitHandler<LoginFormValues> = (data) => {
    const mutation = gql`
      mutation Login($email: String!, $password: String!) {
        Login(email: $email, password: $password) {
          Response
          token
        }
      }
    `;

    setIsLoading(true);
    client.mutate<LoginMutationResponse>({
      mutation,
      variables: { email: data.email, password: data.password },
      fetchPolicy: "no-cache",
    })
        .then((res) => {
          if (res.data?.Login.Response.includes("Success")) {
            const token = res.data.Login.token ?? '';
            localStorage.setItem("userEmail", data.email);
            localStorage.setItem("token", token);
            document.cookie = `arno-auth=${token}; path=/; max-age=${6 * 3600}; SameSite=Lax`;
            toast.success("Login Success.");
            router.push("/dashboard");
          } else if (res.data?.Login.Response === "Invalid Password") {
            toast.error("Invalid Credentials");
          } else {
            toast.error(res.data?.Login.Response ?? 'Login failed');
          }
        })
        .catch((err) => {
          toast.error(err.message);
        })
        .finally(() => {
          setIsLoading(false);
          reset();
        });
  };

  return (
      <div
          className="min-h-screen flex items-center justify-center relative overflow-hidden"
          style={{ background: 'var(--bg-primary)' }}
      >
        <div className="absolute inset-0 hatch-overlay opacity-100 pointer-events-none" />
        <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, var(--border-default) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
              opacity: 0.4,
            }}
        />
        <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%)', opacity: 0.6 }}
        />
        <div className="absolute top-5 right-5 z-20">
          <ThemeToggle />
        </div>

        <div className="relative z-10 w-full max-w-sm px-6">
          <div className="mb-10 text-center flex flex-col items-center gap-3">
            <Image
                src={logoSrc}
                alt="ARNOBOT"
                width={180}
                height={44}
                className="object-contain"
                style={{ maxHeight: 44 }}
                unoptimized
                priority
            />
            <p className="eyebrow" style={{ color: 'var(--text-secondary)' }}>
              Ground Control Station
            </p>
          </div>

          <div className="gcs-card p-8" style={{ borderColor: 'var(--border-default)' }}>
            <h2
                className="text-lg font-semibold mb-6 tracking-wider uppercase"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-syne)' }}
            >
              Operator Login
            </h2>

            {/* fix 2: form now correctly calls handleSubmit(onSubmit) */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label
                    className="block text-xs font-medium mb-1.5 eyebrow"
                    style={{ color: 'var(--text-secondary)' }}
                >
                  Email
                </label>
                {/* fix 3: use register() so react-hook-form controls the input */}
                <input
                    type="email"
                    {...register("email", { required: "Email is required" })}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-all"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e)  => (e.target.style.borderColor = 'var(--border-default)')}
                />
                {errors.email && (
                    <p className="text-xs mt-1" style={{ color: 'red' }}>
                      {errors.email.message}
                    </p>
                )}
              </div>

              <div>
                <label
                    className="block text-xs font-medium mb-1.5 eyebrow"
                    style={{ color: 'var(--text-secondary)' }}
                >
                  Password
                </label>
                <input
                    type="password"
                    {...register("password", { required: "Password is required" })}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-all"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e)  => (e.target.style.borderColor = 'var(--border-default)')}
                />
                {errors.password && (
                    <p className="text-xs mt-1" style={{ color: 'red' }}>
                      {errors.password.message}
                    </p>
                )}
              </div>

              <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-md text-sm font-semibold transition-all mt-2 disabled:opacity-50 uppercase tracking-widest"
                  style={{
                    background: 'var(--accent)',
                    color: theme === 'dark' ? '#000' : '#fff',
                    fontFamily: 'var(--font-syne)',
                    letterSpacing: '0.1em',
                  }}
              >
                {isLoading ? 'Authenticating…' : 'Login'}
              </button>
            </form>

            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-xs text-center" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)' }}>
                Demo: admin@arnobot.in / arnobot123
              </p>
            </div>
          </div>

          <p
              className="text-center text-xs mt-6 eyebrow"
              style={{ color: 'var(--text-dim)' }}
          >
            ARNOBOT &mdash; Robotics Redefined &copy; 2025
          </p>
        </div>
      </div>
  );
}