import Link from "next/link"
import { CardsThree } from "@phosphor-icons/react/dist/ssr"

export function AuthLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 self-center font-medium">
      <div className="flex size-8 items-center justify-center rounded-md bg-black text-white">
        <CardsThree weight="fill" size={20} />
      </div>
      Recipe Room
    </Link>
  )
}
