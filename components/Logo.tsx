import React from "react";
import clsx from "clsx";
import LogoImg from "../assets/logo.png";

interface LogoProps {
  size?: number;
  withText?: boolean;
  className?: string;
  textClassName?: string;
  imgClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  withText = true,
  className,
  textClassName,
  imgClassName
}) => {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <img
        src={LogoImg}
        alt="Controlar+"
        style={{ width: size, height: size }}
        className={clsx("object-contain", imgClassName)}
      />
      {withText && (
        <span className={clsx("font-bold tracking-tight", textClassName)}>
          Controlar<span className="text-[#d97757]">+</span>
        </span>
      )}
    </div>
  );
};
