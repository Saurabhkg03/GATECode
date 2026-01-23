import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const { username } = await params;
    return {
        title: `${username} | GATE Code`,
        description: `View the profile and statistics of ${username} on GATE Code.`,
    };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return <ProfileClient username={username} />;
}
