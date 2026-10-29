import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  plain?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', plain = false }) => {
  const logoSizes = {
    sm: 'h-10 w-10 rounded-xl',
    md: 'h-12 w-12 rounded-2xl',
    lg: 'h-24 w-24 rounded-[1.35rem]',
    xl: 'h-32 w-32 rounded-[1.35rem]',
  };

  return (
    <img
      src="/store-acessorios-logo.webp"
      alt="Store Acessórios"
      width={size === 'xl' ? 128 : size === 'lg' ? 96 : size === 'md' ? 48 : 40}
      height={size === 'xl' ? 128 : size === 'lg' ? 96 : size === 'md' ? 48 : 40}
      decoding="async"
      className={`${logoSizes[size]} shrink-0 object-contain grayscale ${plain ? 'rounded-none border-0 bg-transparent shadow-none mix-blend-multiply' : 'border border-zinc-700/60 bg-white shadow-lg shadow-black/10'}`}
    />
  );
};
