import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminSocket } from "@/lib/adminSocket";

export function useSocketEvent(event: string, handler: () => void) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getAdminSocket();
    const listener = () => savedHandler.current();
    socket.on(event, listener);
    return () => { socket.off(event, listener); };
  }, [event]);
}

export function useSocketInvalidate(event: string, queryKey: string[]) {
  const queryClient = useQueryClient();
  const keyRef = useRef(queryKey);

  useEffect(() => {
    keyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    const socket = getAdminSocket();
    const handler = () => queryClient.invalidateQueries({ queryKey: keyRef.current });
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, queryClient]);
}
