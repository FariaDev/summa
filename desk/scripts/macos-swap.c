#include <stdio.h>
#include <sys/stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fputs("usage: summa-swap <installed app> <staged app>\n", stderr);
        return 2;
    }
    if (renamex_np(argv[1], argv[2], RENAME_SWAP) == 0) return 0;
    perror("renamex_np(RENAME_SWAP)");
    return 1;
}
