// React - Next default
import React, { useEffect, useState } from "react";

// Libs
import { FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";

// Icons
import { IconType } from "react-icons";
import { MdMailOutline } from "react-icons/md";

interface InputProps {
    id: string;
    label: string;
    type?: string;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    maxLength?: number;
    register: UseFormRegister<FieldValues>;
    errors: FieldErrors;
    icon?: IconType;
    className?: string;
    autoComplete?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Input: React.FC<InputProps> = ({
                                         id,
                                         label,
                                         type = "text",
                                         disabled = false,
                                         required = false,
                                         placeholder = "",
                                         register,
                                         maxLength,
                                         errors,
                                         icon: Icon,
                                         className = "",
                                         autoComplete = "off",
                                         value,
                                         onChange = () => {},
                                     }) => {
    const [hasValue, setHasValue] = useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(!!event.target.value);
    };

    useEffect(() => {
        if (!disabled) {
            setHasValue(false);
        }
    }, [disabled]);

    return (
        <div className="flex flex-col items-start justify-center w-full">
            <div className="relative w-full h-full">
                <label
                    htmlFor={id}
                    className={`absolute font-medium duration-100 ease-in z-10 text-[12px] xs:text-base
        ${
                        hasValue
                            ? "text-myBlue1 top-2 left-6 text-[12px] xs:text-sm"
                            : "text-[#8083a3] left-6 top-[26px]"
                    }
        ${errors[id] && "text-myRed1 top-2 left-4 text-[12px] xs:text-sm"}
        `}
                >
                    {label}
                </label>
                <input
                    type={type}
                    id={id}
                    className={`w-full h-[72px] rounded-2xl border-2 border-black dark:border-secondary bg-transparent px-4 pt-2 outline-none focus:border-myBlue1 hover:border-primary transition ${
                        errors[id] && "border-myRed1"
                    } ${className}`}
                    placeholder={placeholder}
                    // inputMode={type === "number" ? "numeric" : "text"}
                    disabled={disabled}
                    {...register(id, { required: required })}
                    autoComplete={autoComplete}
                    value={value}
                    maxLength={maxLength}
                    onInput={(e: React.FormEvent<HTMLInputElement>) => {
                        onChange && onChange(e as React.ChangeEvent<HTMLInputElement>);
                        handleInputChange(e as React.ChangeEvent<HTMLInputElement>);
                    }}
                    // onChange={onChange}
                />
                {Icon ? (
                    <Icon className="absolute right-4 top-6" size={25} />
                ) : (
                    <MdMailOutline className="absolute right-4 top-6" size={25} />
                )}
            </div>

            {errors[id] && (
                <span className="text-red-500 text-sm font-semibold mt-2 ml-4">
          {label} is Required
        </span>
            )}
        </div>
    );
};

export default Input;