import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode, Mail, X, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareModalProps {
  profileUrl: string;
  username: string;
}

export default function ShareModal({ profileUrl, username }: ShareModalProps) {
  const [open, setOpen] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("Link copied to clipboard!");
    } catch (_err) {
      toast.error("Clipboard unavailable. Please copy the link manually.");
    }
  };

  const emailSubject = encodeURIComponent(`Check out ${username}'s dog profile!`);
  const emailBody = encodeURIComponent(
    `I wanted to share this dog training profile with you:\n\n${profileUrl}\n\nCheck out their progress and tricks!`,
  );
  const mailtoLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  const handleEmailClick = () => {
    toast.success("Opening email client...");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 font-medium text-white transition-all hover:from-purple-600 hover:to-blue-600 focus:ring-2 focus:ring-purple-400/50 focus:outline-none">
          <span className="flex items-center justify-center gap-2">
            <Share2 className="size-4" />
            Share Profile
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-4 top-4 bottom-4 overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6 shadow-2xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-8"
          aria-labelledby="share-modal-title"
          aria-describedby="share-modal-description"
        >
          <div className="flex items-start justify-between">
            <Dialog.Title id="share-modal-title" className="text-2xl font-bold text-white">
              Share Profile
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-purple-400/50 focus:outline-none"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description id="share-modal-description" className="sr-only">
            Share {username}&apos;s profile using the methods below
          </Dialog.Description>

          <div className="mt-6 space-y-6">
            {/* Copy Link Section */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Copy className="size-5" />
                <h3 className="font-semibold">Copy Link</h3>
              </div>
              <p className="mb-3 text-sm text-white/70">Copy the profile URL to share anywhere</p>
              <Button
                onClick={handleCopyLink}
                className="h-11 w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 focus:ring-2 focus:ring-purple-400/50"
              >
                Copy to Clipboard
              </Button>
            </div>

            {/* QR Code Section */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-white">
                <QrCode className="size-5" />
                <h3 className="font-semibold">QR Code</h3>
              </div>
              <p className="mb-3 text-sm text-white/70">Scan with a phone camera to visit the profile</p>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={profileUrl} size={200} level="M" />
              </div>
            </div>

            {/* Email Section */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Mail className="size-5" />
                <h3 className="font-semibold">Email</h3>
              </div>
              <p className="mb-3 text-sm text-white/70">Send the profile link via email</p>
              <Button
                asChild
                onClick={handleEmailClick}
                className="h-11 w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 focus:ring-2 focus:ring-purple-400/50"
              >
                <a href={mailtoLink}>Open Email Client</a>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
