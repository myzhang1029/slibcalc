#include <stdlib.h>
#include <time.h>
#include <emscripten.h>
#include <stdio.h>
#include <stdarg.h>

struct tm *newTm(int y,m,d)
{
    struct tm *ptr = malloc(sizeof(struct tm));
    ptr->tm_year=y-1900;
    ptr->tm_mon=m-1;
    ptr->tm_mday=d;
    return ptr;
}
void derefTm(struct tm *ptr, int *hour, int *min, int *sec, int *year, int *mon, int *mday)
{
    *hour=ptr->tm_hour;
}


void wrap_h2hms(double h, void *setData, void (*slib_h2hms)(double, double*, double*, double*))
{
    double oh, om, os;
    slib_h2hms(h, &oh, &om, &os);
    EM_ASM_({
        let str = "结果是：" + $1 + "时" + $2 + "分" + $3 + "秒";
        $0({
            hms_value2: str
        })
    }, setData, oh, om, os);
}
